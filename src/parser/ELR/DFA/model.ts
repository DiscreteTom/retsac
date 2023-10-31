import type { GeneralTokenDataBinding } from "../../../lexer";
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
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = ReadonlyMap<
  Kinds,
  GrammarRule<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >[]
>;
