import type { GrammarSet } from "../model";

/**
 * `NT => Grammars`
 */
// TODO: use Kinds
export type FirstSets<AllKinds extends string> = Map<
  string,
  GrammarSet<AllKinds>
>;

/**
 * `grammar.kind => Grammars`
 */
// TODO: use Kinds
export type FollowSets<AllKinds extends string> = Map<
  string,
  GrammarSet<AllKinds>
>;

/**
 * @see {@link FirstSets}
 */
// TODO: use Kinds
export type ReadonlyFirstSets<AllKinds extends string> = ReadonlyMap<
  string,
  GrammarSet<AllKinds>
>;

/**
 * @see {@link FollowSets}
 */
// TODO: use Kinds
export type ReadonlyFollowSets<AllKinds extends string> = ReadonlyMap<
  string,
  GrammarSet<AllKinds>
>;
