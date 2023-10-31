import type { AtLeastOneOf } from "../../type-helper";
import type { ActionInput } from "./input";

// This has to be a class, since we need to cache the `rest` of the output.
export class AcceptedActionOutput<Data, ErrorType> {
  /**
   * This action can accept some input as a token.
   */
  accept: true;
  /**
   *  The whole input string.
   */
  buffer: string;
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
      | "buffer"
      | "start"
      | "muted"
      | "digested"
      | "error"
      | "content"
      | "data"
      | "_rest"
    >,
  ) {
    this.accept = true;
    this.buffer = props.buffer;
    this.start = props.start;
    this.muted = props.muted;
    this.digested = props.digested;
    this.error = props.error;
    this.content = props.content;
    this.data = props.data;
    this._rest = props._rest;
  }

  static from<Data, ActionState, ErrorType>(
    input: ActionInput<ActionState>,
    output: AcceptedActionExecOutput<Data, ErrorType>,
  ) {
    return new AcceptedActionOutput<Data, ErrorType>({
      buffer: input.buffer,
      start: input.start,
      muted: output.muted,
      digested: output.digested,
      error: output.error,
      content: output.content,
      data: output.data,
      _rest: output._rest,
    });
  }

  /**
   * Convert to a simple object instead of an instance of `AcceptedActionOutput`.
   *
   * `rest` is not included in the return value,
   * so its safe to expand the return value.
   */
  toExecOutput(): AcceptedActionExecOutput<Data, ErrorType> {
    return {
      accept: this.accept,
      muted: this.muted,
      digested: this.digested,
      error: this.error,
      content: this.content,
      data: this.data,
      _rest: this._rest,
    };
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

export type RejectedActionOutput = typeof rejectedActionOutput;

export type ActionOutput<Data, ErrorType> =
  | RejectedActionOutput
  | AcceptedActionOutput<Data, ErrorType>;

/**
 * AcceptedActionOutput without `buffer`, `start` and `rest`.
 */
export type AcceptedActionExecOutput<Data, ErrorType> = Pick<
  AcceptedActionOutput<Data, ErrorType>,
  "accept" | "muted" | "digested" | "error" | "content" | "data" | "_rest"
>;

export type ActionExecOutput<Data, ErrorType> =
  | typeof rejectedActionOutput
  | AcceptedActionExecOutput<Data, ErrorType>;

/**
 * Make unnecessary fields optional.
 * One of `content` or `digested` must be provided.
 */
export type SimpleAcceptedActionExecOutput<Data, ErrorType> = Partial<
  Pick<
    AcceptedActionOutput<Data, ErrorType>,
    "muted" | "error" | "digested" | "content" | "data" | "_rest"
  >
> &
  AtLeastOneOf<AcceptedActionOutput<Data, ErrorType>, "digested" | "content">;
