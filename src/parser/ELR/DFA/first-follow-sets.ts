import type { GrammarSet } from "../model";

/**
 * `NT => Grammars`
 */
export type ReadonlyFirstSets<
  Kinds extends string,
  LexerKinds extends string,
> = ReadonlyMap<Kinds, GrammarSet<Kinds | LexerKinds>>;

/**
 * `grammar.kind => Grammars`
 */
export type ReadonlyFollowSets<AllKinds extends string> = ReadonlyMap<
  AllKinds,
  GrammarSet<AllKinds>
>;
