import type { AtLeastOneOf } from "../../type-helper";

// This has to be a class, since we need to cache the `rest` of the input.
export class AcceptedActionOutput<Data, ErrorType> {
  /**
   * This action can accept some input as a token.
   */
  accept: true;
  /**
   *  The whole input string.
   */
  buffer: string; // TODO: maybe Action should not return accepted action output?
  /**
   * Index of the first char of this token in the whole input string.
   */
  start: number;
  /**
   * Don't emit token, continue lex.
   */
  muted: boolean;
  /**
   * How many chars are accepted by this action.
   */
  digested: number;
  /**
   * Accept, but set an error to mark this token.
   */
  error?: ErrorType;
  /**
   * The content of the token, equals to `input.slice(start, start + digested)`.
   * This is not lazy since we need this to calculate `lexer.lineChars`.
   */
  content: string;
  /**
   * User-defined data stored in this token.
   */
  data: Data;
  /**
   * The raw rest. If your action can yield the rest of the input, you should set this field.
   * @default undefined
   */
  _rest?: string;

  constructor(
    props: Pick<
      AcceptedActionOutput<Data, ErrorType>,
      "buffer" | "start" | "muted" | "digested" | "error" | "content" | "data"
    > &
      Partial<Pick<AcceptedActionOutput<Data, ErrorType>, "rest">>,
  ) {
    this.accept = true;
    this.buffer = props.buffer;
    this.start = props.start;
    this.muted = props.muted;
    this.digested = props.digested;
    this.error = props.error;
    this.content = props.content;
    this.data = props.data;
    this._rest = props.rest;
  }

  /**
   * The rest of the input, equals to `input.slice(start + digested)`.
   * This is lazy and cached.
   */
  get rest() {
    return (
      this._rest ?? (this._rest = this.buffer.slice(this.start + this.digested))
    );
  }
}

export const rejectedActionOutput = Object.freeze({ accept: false });

export type ActionOutput<Data, ErrorType> =
  | typeof rejectedActionOutput
  | AcceptedActionOutput<Data, ErrorType>;

/**
 * The simple version of `AcceptedActionOutput`.
 * Users can use this type to create an action output.
 */
export type SimpleAcceptedActionOutput<Data, ErrorType> = Partial<
  Pick<
    AcceptedActionOutput<Data, ErrorType>,
    "muted" | "error" | "rest" | "digested" | "content" | "data" // TODO: maybe data is required?
  >
> &
  AtLeastOneOf<AcceptedActionOutput<Data, ErrorType>, "digested" | "content">;
