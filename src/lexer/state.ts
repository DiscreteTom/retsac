import type { GeneralTokenDataBinding, Token } from "./model";

export class LexerState<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
> {
  buffer: string;
  digested: number;
  lineChars: number[];
  trimmed: boolean;
  errors: Readonly<Token<DataBindings, ErrorType>>[];
  rest: string | undefined;

  constructor() {
    this.reset();
  }

  reset() {
    this.buffer = "";
    this.digested = 0;
    this.lineChars = [0];
    this.trimmed = true; // no input, no need to trim
    this.errors = [];
    this.rest = undefined;
  }

  /**
   * Append new input to the end of the buffer and update related states.
   */
  feed(input: string) {
    if (input.length == 0) return;
    this.buffer += input;
    this.trimmed = false; // maybe the new feed chars can construct a new token
    this.rest = undefined; // clear cache
  }

  /**
   * Take `n` chars from the buffer and update related states.
   * The caller should ensure the `n` is valid, and provide the content.
   *
   * If the caller can get the rest unintentionally, it can be passed to the `rest` parameter.
   */
  take(n: number, content: string, rest: string | undefined) {
    if (n == 0) return;

    this.digested += n;
    this.trimmed = this.digested == this.buffer.length; // if all chars are digested, no need to trim
    this.rest = rest;

    // calculate line chars
    // `split` is faster than iterate all chars
    content.split("\n").forEach((part, i, list) => {
      this.lineChars[this.lineChars.length - 1] += part.length;
      if (i != list.length - 1) {
        this.lineChars[this.lineChars.length - 1]++; // add '\n'
        this.lineChars.push(0); // new line with 0 chars
      }
    });
  }

  clone() {
    const state = new LexerState<DataBindings, ErrorType>();
    state.buffer = this.buffer;
    state.digested = this.digested;
    state.lineChars = this.lineChars.slice();
    state.trimmed = this.trimmed;
    state.errors = this.errors.slice();
    state.rest = this.rest;
    return state;
  }

  setTrimmed() {
    this.trimmed = true;
  }

  getRest() {
    return this.rest ?? (this.rest = this.buffer.slice(this.digested));
  }
}
