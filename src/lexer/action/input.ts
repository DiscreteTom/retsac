import { Lazy, type ReadonlyLazyString } from "../../helper";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Builder } from "../builder";

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
   * The rest of the input before the action is executed, lazy and cached.
   * Equals to `buffer.slice(start)`.
   */
  readonly rest: ReadonlyLazyString;
  /**
   * The state set by {@link Builder.state}
   */
  readonly state: ActionState;

  constructor(
    props: Pick<ActionInput<ActionState>, "buffer" | "start" | "state"> & {
      rest: string | undefined;
    },
  ) {
    this.buffer = props.buffer;
    this.start = props.start;
    this.state = props.state;
    this.rest = new Lazy(() => this.buffer.slice(this.start), props.rest);
  }
}
