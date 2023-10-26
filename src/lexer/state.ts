import type { Token, TokenDataBinding } from "./model";

export class LexerState<
  Data,
  ErrorType,
  Kinds extends string,
  DataBindings extends TokenDataBinding<Kinds, Data>,
> {
  buffer: string;
  digested: number;
  lineChars: number[];
  trimmed: boolean;
  errors: Readonly<Token<ErrorType, Kinds, Data, DataBindings>>[];
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

  feed(input: string) {
    if (input.length == 0) return;
    this.buffer += input;
    this.trimmed = false; // maybe the new feed chars can construct a new token
    this.rest = undefined; // clear cache
  }

  update(digested: number, content: string, rest: string | undefined) {
    if (digested == 0) return;

    this.digested += digested;
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
    const state = new LexerState<Data, ErrorType, Kinds, DataBindings>();
    state.buffer = this.buffer;
    state.digested = this.digested;
    state.lineChars = this.lineChars.slice();
    state.trimmed = this.trimmed;
    state.errors = this.errors.slice();
    state.rest = this.rest;
    return state;
  }
}
