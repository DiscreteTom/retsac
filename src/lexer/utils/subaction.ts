import {
  makeRegexAutoSticky,
  type ActionInput,
  checkRegexNotStartsWithCaret,
} from "../action";

/**
 * Return how many chars are digested (0 is acceptable).
 * Return `undefined` if the sub-action is rejected.
 */
export type SubActionExec<ActionState> = (
  input: ActionInput<ActionState>,
  /**
   * Index of the next char to be read.
   */
  pos: number,
) => number | undefined;

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
      input.buffer.startsWith(s, pos) ? s.length : undefined,
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
      return res ? res[0].length : undefined;
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
