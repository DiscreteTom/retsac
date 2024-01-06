import type { GeneralTokenDataBinding } from "../../../lexer";
import type { GrammarRule, GrammarSet } from "../model";

/**
 * `NT => Grammars`
 */
export type ReadonlyFirstSets<
  NTs extends string,
  LexerKinds extends string,
> = ReadonlyMap<NTs, GrammarSet<NTs, LexerKinds>>;

/**
 * `grammar.kind => Grammars`
 */
export type ReadonlyFollowSets<
  NTs extends string,
  LexerKinds extends string,
> = ReadonlyMap<NTs | LexerKinds, GrammarSet<NTs, LexerKinds>>;

export type ReadonlyNTClosures<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = ReadonlyMap<
  NTs,
  GrammarRule<
    NTs,
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >[]
>;
