import { AtLeastOneOf } from "../../type-helper";

// This has to be a class, since we need to cache the `rest` of the input.
export class AcceptedActionOutput<ErrorType> {
  /** This action can accept some input as a token. */
  accept: true;
  /** The whole input string. */
  buffer: string;
  /** From where to lex. */
  start: number;
  /** Don't emit token, continue lex. */
  muted: boolean;
  /** How many chars are accepted by this action. */
  digested: number;
  /** Accept, but set an error to mark this token. */
  error?: ErrorType;
  /**
   * The content of the token, equals to `input.slice(start, start + digested)`.
   * This is not lazy since we need this to calculate `lexer.lineChars`.
   */
  content: string;
  /**
   * The raw rest. If your action can yield the rest of the input, you should set this field.
   * @default undefined
   */
  _rest?: string;

  constructor(
    data: Pick<
      AcceptedActionOutput<ErrorType>,
      "buffer" | "start" | "muted" | "digested" | "error" | "content"
    > &
      Partial<Pick<AcceptedActionOutput<ErrorType>, "rest">>
  ) {
    this.accept = true;
    this.buffer = data.buffer;
    this.start = data.start;
    this.muted = data.muted;
    this.digested = data.digested;
    this.error = data.error;
    this.content = data.content;
    this._rest = data.rest;
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

export type ActionOutput<ErrorType> =
  | typeof rejectedActionOutput
  | AcceptedActionOutput<ErrorType>;

/**
 * The simple version of `AcceptedActionOutput`.
 * Users can use this type to create an action output.
 */
export type SimpleAcceptedActionOutput<ErrorType> = Partial<
  Pick<
    AcceptedActionOutput<ErrorType>,
    "muted" | "error" | "rest" | "digested" | "content"
  >
> &
  AtLeastOneOf<AcceptedActionOutput<ErrorType>, "digested" | "content">;
