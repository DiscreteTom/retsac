import {
  makeRegexAutoSticky,
  type ActionInput,
  type RejectedActionOutput,
  checkRegexNotStartsWithCaret,
} from "../action";

export type AcceptedSubActionOutput = {
  accept: true;
  /**
   * How many chars are digested by the sub-action.
   */
  digested: number;
};

export type SubActionExec<ActionState> = (
  input: ActionInput<ActionState>,
  /**
   * Index of the next char to be read.
   */
  pos: number,
) => AcceptedSubActionOutput | RejectedActionOutput;

/**
 * These types can be converted to a sub-action by {@link SubAction.from}.
 */
export type IntoSubAction<ActionState> =
  | SubAction<ActionState>
  | SubActionExec<ActionState>
  | string
  | RegExp;

export class SubAction<ActionState> {
  constructor(public readonly exec: SubActionExec<ActionState>) {}

  static str<ActionState>(s: string) {
    return new SubAction<ActionState>((input, pos) =>
      input.buffer.startsWith(s, pos)
        ? { accept: true, digested: s.length }
        : { accept: false },
    );
  }

  static match<ActionState>(
    r: RegExp,
    options?: {
      /**
       * Auto add the `sticky` flag to the `from` regex if `g` and `y` is not set.
       * @default true
       */
      autoSticky?: boolean;
      /**
       * Reject if the regex starts with `^`.
       * @default true
       */
      rejectCaret?: boolean;
    },
  ) {
    if (options?.autoSticky ?? true) r = makeRegexAutoSticky(r);
    if (options?.rejectCaret ?? true) checkRegexNotStartsWithCaret(r);

    return new SubAction<ActionState>((input, pos) => {
      r.lastIndex = pos;
      const res = r.exec(input.buffer);
      return res
        ? { accept: true, digested: res[0].length }
        : { accept: false };
    });
  }

  static from<ActionState>(
    src: IntoSubAction<ActionState>,
  ): SubAction<ActionState> {
    if (src instanceof SubAction) return src;
    if (typeof src === "function") return new SubAction(src);
    if (typeof src === "string") return SubAction.str(src);
    return SubAction.match(src);
  }
}
