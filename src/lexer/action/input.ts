import { LazyString, type ReadonlyLazyString } from "../../lazy";

export class ActionInput<ActionState> {
  /**
   * The whole input string.
   */
  readonly buffer: string;
  /**
   * From where to lex.
   */
  readonly start: number;
  /**
   * Whether this evaluation is a peek.
   * If `true`, you may NOT want to mutate the action state.
   * @default false
   */
  readonly peek: boolean;
  /**
   * The rest of the input before the action is executed, lazy and cached.
   */
  readonly rest: ReadonlyLazyString;
  readonly state: ActionState;

  constructor(
    props: Pick<
      ActionInput<ActionState>,
      "buffer" | "start" | "peek" | "state"
    > & { rest: string | undefined },
  ) {
    this.buffer = props.buffer;
    this.start = props.start;
    this.peek = props.peek;
    this.state = props.state;
    this.rest = new LazyString(() => this.buffer.slice(this.start), props.rest);
  }
}
