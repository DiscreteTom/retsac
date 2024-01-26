import type { GeneralTokenDataBinding } from "./model";

// don't export this class because we don't want user to modify its fields directly.
// user should only use the methods provided by the interface.
export class LexerState<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
> {
  buffer: string;
  digested: number;
  trimmed: boolean;
  rest: string | undefined;

  constructor(buffer: string) {
    this.buffer = buffer;
    this.digested = 0;
    this.trimmed = buffer.length === 0; // if buffer is empty, no need to trim
    this.rest = undefined;
  }

  // TODO: rename
  take(n: number, rest: string | undefined) {
    if (n === 0) return;

    this.digested += n;
    this.trimmed = this.digested === this.buffer.length; // if all chars are digested, no need to trim
    this.rest = rest;
  }

  clone() {
    const state = new LexerState<DataBindings, ErrorType>(this.buffer);
    state.digested = this.digested;
    state.trimmed = this.trimmed;
    state.rest = this.rest;
    return state;
  }

  // TODO: use trim
  setTrimmed() {
    this.trimmed = true;
  }

  getRest() {
    return this.rest ?? (this.rest = this.buffer.slice(this.digested));
  }
}
