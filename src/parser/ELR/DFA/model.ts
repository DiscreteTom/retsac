import type { GrammarRule, GrammarSet } from "../model";

/**
 * `NT => Grammars`
 */
export type ReadonlyFirstSets<
  Kinds extends string,
  LexerKinds extends string,
> = ReadonlyMap<Kinds, GrammarSet<Kinds, LexerKinds>>;

/**
 * `grammar.kind => Grammars`
 */
export type ReadonlyFollowSets<
  Kinds extends string,
  LexerKinds extends string,
> = ReadonlyMap<Kinds | LexerKinds, GrammarSet<Kinds, LexerKinds>>;

export type ReadonlyNTClosures<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> = ReadonlyMap<
  Kinds,
  GrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >[]
>;
