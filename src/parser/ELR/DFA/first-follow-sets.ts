import type { GrammarSet } from "../model";

/**
 * `NT => Grammars`
 */
export type FirstSets<Kinds extends string, LexerKinds extends string> = Map<
  Kinds,
  GrammarSet<Kinds | LexerKinds>
>;

/**
 * `grammar.kind => Grammars`
 */
export type FollowSets<AllKinds extends string> = Map<
  AllKinds,
  GrammarSet<AllKinds>
>;

/**
 * @see {@link FirstSets}
 */
export type ReadonlyFirstSets<
  Kinds extends string,
  LexerKinds extends string,
> = ReadonlyMap<Kinds, GrammarSet<Kinds | LexerKinds>>;

/**
 * @see {@link FollowSets}
 */
export type ReadonlyFollowSets<AllKinds extends string> = ReadonlyMap<
  AllKinds,
  GrammarSet<AllKinds>
>;
