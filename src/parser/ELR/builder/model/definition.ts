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
  LexerKinds extends string,
> {
  resolved: ResolvedPartialTempConflict<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds
  >[];
  callback?: Callback<ASTData, ErrorType, Kinds, LexerKinds>;
  rejecter?: Condition<ASTData, ErrorType, Kinds, LexerKinds>;
  rollback?: Callback<ASTData, ErrorType, Kinds, LexerKinds>;
  commit?: Condition<ASTData, ErrorType, Kinds, LexerKinds>;
  traverser?: Traverser<ASTData, ErrorType, Kinds | LexerKinds>;
}
