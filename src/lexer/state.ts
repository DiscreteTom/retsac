import type { LazyString } from "../helper";
import { Lazy } from "../helper";
import type {
  GeneralTokenDataBinding,
  ILexerState,
  IReadonlyLexerState,
} from "./model";

// don't export this class because we don't want user to modify its fields directly.
// user should only use the methods provided by the interface.
export class LexerState<DataBindings extends GeneralTokenDataBinding, ErrorType>
  implements ILexerState<DataBindings, ErrorType>
{
  buffer: string;
  digested: number;
  trimmed: boolean;
  rest: LazyString;

  constructor(buffer: string) {
    this.buffer = buffer;
    this.digested = 0;
    this.trimmed = buffer.length === 0; // if buffer is empty, no need to trim
    this.rest = new Lazy(() => this.buffer.slice(this.digested));
  }

  get readonly() {
    return this as IReadonlyLexerState<DataBindings, ErrorType>;
  }

  clone() {
    const state = new LexerState<DataBindings, ErrorType>(this.buffer);
    state.digested = this.digested;
    state.trimmed = this.trimmed;
    state.rest = this.rest;
    return state;
  }

  digest(n: number, rest: string | undefined) {
    if (n === 0) return;

    this.digested += n;
    this.trimmed = this.digested === this.buffer.length; // if all chars are digested, no need to trim
    this.rest.value = rest;
  }

  trim(n: number, rest: string | undefined) {
    this.digested += n;
    this.trimmed = true;
    this.rest.value = rest;
  }

  hasRest() {
    return this.digested < this.buffer.length;
  }
}
