import type { GeneralTokenDataBinding, ILexerState, Token } from "./model";

// don't export this class because we don't want user to modify its fields directly.
// user should only use the methods provided by the interface.
class LexerState<DataBindings extends GeneralTokenDataBinding, ErrorType>
  implements ILexerState<DataBindings, ErrorType>
{
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

  feed(input: string) {
    if (input.length === 0) return;
    this.buffer += input;
    this.trimmed = false; // maybe the new feed chars can construct a new token
    this.rest = undefined; // clear cache
  }

  take(n: number, content: string, rest: string | undefined) {
    if (n === 0) return;

    this.digested += n;
    this.trimmed = this.digested === this.buffer.length; // if all chars are digested, no need to trim
    this.rest = rest;

    // calculate line chars
    // `split` is faster than iterate all chars
    content.split("\n").forEach((part, i, list) => {
      this.lineChars[this.lineChars.length - 1] += part.length;
      if (i !== list.length - 1) {
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

/**
 * Create a new {@link ILexerState}.
 */
export function lexerStateFactory<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
>(): ILexerState<DataBindings, ErrorType> {
  return new LexerState<DataBindings, ErrorType>();
}
