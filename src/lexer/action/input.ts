export class ActionInput<ActionState> {
  /** The whole input string. */
  readonly buffer: string;
  /** From where to lex. */
  readonly start: number;
  readonly state: ActionState;
  private _rest?: string;

  constructor(
    data: Pick<ActionInput<ActionState>, "buffer" | "start" | "state"> &
      // maybe the rest is provided by the last accepted action's output
      // or is calculated by lexer.getRest
      Partial<Pick<ActionInput<ActionState>, "rest">>,
  ) {
    this.buffer = data.buffer;
    this.start = data.start;
    this.state = data.state;
    this._rest = data.rest;
  }

  /**
   * The rest of the input, equals to `input.slice(start)`.
   * This is lazy and cached.
   */
  get rest() {
    return this._rest ?? (this._rest = this.buffer.slice(this.start));
  }
}
