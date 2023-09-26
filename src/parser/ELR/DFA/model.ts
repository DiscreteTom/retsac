import type { GrammarRule, GrammarSet } from "../model";

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

export type ReadonlyNTClosures<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = ReadonlyMap<
  Kinds,
  GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[]
>;
