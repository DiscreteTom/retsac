import { Lazy, type ReadonlyLazyString } from "../../lazy";
import type { AtLeastOneOf } from "../../type-helper";
import type { ActionInput } from "./input";

export class AcceptedActionOutput<Data, ErrorType> {
  /**
   * This action can accept some input as a token.
   */
  accept: true;
  /**
   *  The whole input string.
   */
  readonly buffer: string;
  /**
   * Index of the first char of this token in the whole input string.
   */
  readonly start: number;
  /**
   * How many chars are accepted by this action.
   */
  digested: number;
  /**
   * The content of the token, equals to `input.slice(start, start + digested)`.
   * This is not lazy since we need this to calculate `lexer.lineChars`.
   */
  content: string;
  /**
   * Don't emit token, continue lex.
   */
  muted: boolean;
  /**
   * User-defined data stored in this token.
   */
  data: Data;
  /**
   * If not `undefined`, this means the action is accepted
   * with `token.error` set.
   * @default undefined
   */
  error?: ErrorType;
  /**
   * The rest of the input after the action is executed, lazy and cached.
   */
  readonly rest: ReadonlyLazyString;

  constructor(
    props: Pick<
      AcceptedActionOutput<Data, ErrorType>,
      "buffer" | "start" | "muted" | "digested" | "error" | "content" | "data"
    > & { rest: string | undefined },
  ) {
    this.accept = true;
    this.buffer = props.buffer;
    this.start = props.start;
    this.muted = props.muted;
    this.digested = props.digested;
    this.error = props.error;
    this.content = props.content;
    this.data = props.data;
    this.rest = new Lazy(
      () => this.buffer.slice(this.start + this.digested),
      props.rest,
    );
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
      rest: output.rest,
    });
  }
}

export const rejectedActionOutput = Object.freeze({ accept: false });

export type RejectedActionOutput = typeof rejectedActionOutput;

export type ActionOutput<Data, ErrorType> =
  | RejectedActionOutput
  | AcceptedActionOutput<Data, ErrorType>;

/**
 * ActionExec's output. No `buffer` and `start` fields.
 */
export type AcceptedActionExecOutput<Data, ErrorType> = Pick<
  AcceptedActionOutput<Data, ErrorType>,
  "accept" | "content" | "data" | "digested" | "error" | "muted"
> & {
  /**
   * The rest of the input after the action is executed.
   * If your action can yield the rest unintentionally, you could set this field.
   * @default undefined
   */
  rest?: string;
};

export type ActionExecOutput<Data, ErrorType> =
  | typeof rejectedActionOutput
  | AcceptedActionExecOutput<Data, ErrorType>;

/**
 * Make unnecessary fields optional.
 * One of `content` or `digested` must be provided.
 */
export type SimpleAcceptedActionExecOutput<Data, ErrorType> = Partial<
  Pick<
    AcceptedActionExecOutput<Data, ErrorType>,
    "muted" | "error" | "digested" | "content" | "data" | "rest"
  >
> &
  AtLeastOneOf<AcceptedActionOutput<Data, ErrorType>, "digested" | "content">;
