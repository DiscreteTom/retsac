import type { GrammarSet } from "../model";

/**
 * `NT => Grammars`
 */
export type FirstSets<AllKinds extends string> = Map<
  string,
  GrammarSet<AllKinds>
>;
/**
 * `NT => Grammars`
 */
export type ReadonlyFirstSets<AllKinds extends string> = ReadonlyMap<
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
 * `grammar.kind => Grammars`
 */
export type ReadonlyFollowSets<AllKinds extends string> = ReadonlyMap<
  string,
  GrammarSet<AllKinds>
>;
