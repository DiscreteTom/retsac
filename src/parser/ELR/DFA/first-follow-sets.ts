import type { GrammarSet } from "../model";

/**
 * `NT => Grammars`
 */
export type FirstSets<AllKinds extends string> = Map<
  string,
  GrammarSet<AllKinds>
>;

/**
 * `grammar.kind => Grammars`
 */
export type FollowSets<AllKinds extends string> = Map<
  string,
  GrammarSet<AllKinds>
>;

/**
 * @see {@link FirstSets}
 */
export type ReadonlyFirstSets<AllKinds extends string> = ReadonlyMap<
  string,
  GrammarSet<AllKinds>
>;

/**
 * @see {@link FollowSets}
 */
export type ReadonlyFollowSets<AllKinds extends string> = ReadonlyMap<
  string,
  GrammarSet<AllKinds>
>;
