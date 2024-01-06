import type { GeneralTokenDataBinding, Token } from "../../../../lexer";
import type { NTNodeTraverser } from "../../../traverser";
import type { Callback, Condition } from "../../model";
import type { ResolvedPartialTempConflict } from "./resolver";

// TODO: apply this in Definition?
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type JoinableString<
  Target extends string,
  Arr extends string,
> = Target extends ` ${infer Tail}` // first, remove the leading space
  ? JoinableString<Tail, Arr> // continue
  : Target extends `${infer Head} ${infer Tail}` // no leading space now, take the first word
  ? Head extends Arr // check if the first word is in the array
    ? JoinableString<Tail, Arr> // word is valid, continue
    : false // word is invalid, reject
  : Target extends Arr // the last word, check if it is in the array
  ? true
  : Target extends "" // no more words, accept
  ? true
  : false;

// TODO: make this readonly
export type Definition<Kinds extends string> = {
  [NT in Kinds]?: string | string[];
};

export interface DefinitionContext<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> {
  resolved: ResolvedPartialTempConflict<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >[];
  callback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  rejecter?: Condition<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  rollback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  commit?: Condition<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  traverser?: NTNodeTraverser<
    NTs,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >;
  // TODO: reParse?: boolean;
}

export enum DefinitionAssociativity {
  LeftToRight,
  RightToLeft,
}

export class DefinitionGroupWithAssociativity<Kinds extends string> {
  constructor(
    public associativity: DefinitionAssociativity,
    public defs: Definition<Kinds>[],
  ) {}
}

export function leftToRight<Kinds extends string>(
  ...defs: Definition<Kinds>[]
) {
  return new DefinitionGroupWithAssociativity(
    DefinitionAssociativity.LeftToRight,
    defs,
  );
}

export function rightToLeft<Kinds extends string>(
  ...defs: Definition<Kinds>[]
) {
  return new DefinitionGroupWithAssociativity(
    DefinitionAssociativity.RightToLeft,
    defs,
  );
}
