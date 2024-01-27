import { Lazy, type ReadonlyLazyString } from "../../helper";
import type { ActionInput } from "./input";

// don't use data bindings as the type parameter
// since we need Kind and Data separately to do type inference for `Action.exec/simple`.
export type ActionOutput<Kinds extends string, Data, ErrorType> = {
  /**
   * User-defined token kind name.
   */
  kind: Kinds;
  /**
   * User-defined data stored in this token.
   */
  data: Data;
  /**
   * How many chars are accepted by this action.
   */
  digested: number;
  /**
   * Don't emit token, continue lex.
   */
  muted: boolean;
  /**
   * If not `undefined`, this means the action is accepted
   * with `token.error` set.
   * @default undefined
   */
  error?: ErrorType | undefined;
  /**
   * The rest of the input after the action is executed.
   * If your action can yield the rest unintentionally, you could set this field.
   * @default undefined
   */
  rest?: string;
};

export type ActionOutputWithoutKind<Data, ErrorType> = Pick<
  ActionOutput<never, Data, ErrorType>,
  "data" | "digested" | "muted" | "error" | "rest"
>;

export class EnhancedActionOutput<Kinds extends string, Data, ErrorType> {
  readonly raw: ActionOutput<Kinds, Data, ErrorType>;
  /**
   *  The whole input string.
   */
  readonly buffer: string;
  /**
   * Index of the first char of this token in the whole input string.
   */
  readonly start: number;
  readonly rest: ReadonlyLazyString;
  get kind(): Kinds {
    return this.raw.kind;
  }
  get data(): Data {
    return this.raw.data;
  }
  get digested(): number {
    return this.raw.digested;
  }
  get muted(): boolean {
    return this.raw.muted;
  }
  get error(): ErrorType | undefined {
    return this.raw.error;
  }
  get content(): string {
    return this.buffer.slice(this.start, this.start + this.digested);
  }

  constructor(
    props: Pick<
      EnhancedActionOutput<Kinds, Data, ErrorType>,
      "buffer" | "start" | "raw"
    >,
  ) {
    this.buffer = props.buffer;
    this.start = props.start;
    this.rest = new Lazy(
      // set this.raw.rest and return the rest
      () => (this.raw.rest = this.buffer.slice(this.start + this.digested)),
      props.raw.rest,
    );
  }

  /**
   * Get `buffer` and `start` from the `input` and construct the output from the exec output.
   * The `Kinds` of the output will be `never` since `ActionExec` doesn't know the `Kinds`.
   */
  static from<Kinds extends string, Data, ActionState, ErrorType>(
    input: ActionInput<ActionState>,
    output: ActionOutput<Kinds, Data, ErrorType>,
  ): EnhancedActionOutput<Kinds, Data, ErrorType> {
    return new EnhancedActionOutput<Kinds, Data, ErrorType>({
      buffer: input.buffer,
      start: input.start,
      raw: output,
    });
  }
}

/**
 * Make unnecessary fields optional.
 * `digested` must be provided.
 */
export type SimpleActionOutputWithoutKind<Data, ErrorType> =
  // necessary fields
  Pick<ActionOutput<never, never, never>, "digested"> &
    // unnecessary fields
    Partial<
      Pick<
        ActionOutput<never, Data, ErrorType>,
        | "muted"
        | "error"
        | "rest"
        // data should also be optional
        // since we need to infer the data type from the exec output
        | "data"
      >
    >;
