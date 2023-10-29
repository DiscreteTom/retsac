import type { GeneralTokenDataBinding, Token } from "../../../../lexer";
import type { Traverser } from "../../../traverser";
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

export type Definition<Kinds extends string> = {
  [NT in Kinds]?: string | string[];
};

export interface DefinitionContext<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> {
  resolved: ResolvedPartialTempConflict<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >[];
  callback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  rejecter?: Condition<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  rollback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  commit?: Condition<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  traverser?: Traverser<
    ASTData,
    ErrorType,
    Kinds,
    Token<LexerDataBindings, LexerError>
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
