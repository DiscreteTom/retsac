import { Lazy, type ReadonlyLazyString } from "../../helper";
import type { AtLeastOneOf } from "../../helper";
import type {
  ExtractData,
  ExtractKinds,
  GeneralTokenDataBinding,
} from "../model";
import type { ActionInput } from "./input";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { MultiKindsAction } from "./select";

// don't use data bindings as the type parameter
// since we need these info to do type inference for `Action.exec/simple`.
export class AcceptedActionOutput<Kinds extends string, Data, ErrorType> {
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
   * User-defined token kind name.
   */
  readonly kind: Kinds;
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
   * Equals to `buffer.slice(start + digested)`.
   */
  readonly rest: ReadonlyLazyString;

  constructor(
    props: Pick<
      AcceptedActionOutput<Kinds, Data, ErrorType>,
      "buffer" | "start" | "muted" | "digested" | "error" | "content" | "data"
    > & {
      rest: string | undefined;
      /**
       * This should only be set by {@link MultiKindsAction.select}.
       */
      kind: Kinds | undefined;
    },
  ) {
    this.accept = true;
    this.buffer = props.buffer;
    this.start = props.start;
    this.muted = props.muted;
    this.digested = props.digested;
    this.error = props.error;
    this.content = props.content;
    this.data = props.data;
    if (props.kind !== undefined) this.kind = props.kind;
    this.rest = new Lazy(
      () => this.buffer.slice(this.start + this.digested),
      props.rest,
    );
  }

  /**
   * Get `buffer` and `start` from the `input` and construct the output from the exec output.
   * The `Kinds` of the output will be `never` since `ActionExec` doesn't know the `Kinds`.
   */
  static from<Data, ActionState, ErrorType>(
    input: ActionInput<ActionState>,
    output: AcceptedActionExecOutput<Data, ErrorType>,
  ): AcceptedActionOutput<never, Data, ErrorType> {
    return new AcceptedActionOutput<never, Data, ErrorType>({
      buffer: input.buffer,
      start: input.start,
      muted: output.muted,
      digested: output.digested,
      error: output.error,
      content: output.content,
      data: output.data,
      rest: output.rest,
      kind: undefined,
    });
  }
}

export const rejectedActionOutput = Object.freeze({ accept: false });

export type RejectedActionOutput = typeof rejectedActionOutput;

export type ActionOutput<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
> =
  | RejectedActionOutput
  | AcceptedActionOutput<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ErrorType
    >;

/**
 * ActionExec's output. No `buffer` and `start` fields.
 * `Kinds` should be `never` since `Action.exec` doesn't know the `Kinds`.
 */
export type AcceptedActionExecOutput<Data, ErrorType> = Pick<
  AcceptedActionOutput<never, Data, ErrorType>,
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
export type SimpleAcceptedActionExecOutput<Data, ErrorType> =
  // necessary fields
  AtLeastOneOf<
    AcceptedActionOutput<never, never, never>,
    "digested" | "content"
  > &
    // unnecessary fields
    Partial<
      Pick<
        AcceptedActionExecOutput<Data, ErrorType>,
        | "muted"
        | "error"
        | "digested"
        | "content"
        | "rest"
        // data should also be optional
        // since we need to infer the data type from the exec output
        | "data"
      >
    >;
