import { Traverser } from "../../../ast";
import { Callback, Condition } from "../../model";
import { ResolvedPartialTempConflict } from "./resolver";

// TODO: apply this in Definition?
type JoinableString<
  Target extends string,
  Arr extends string
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

export interface DefinitionContext<ASTData, Kinds extends string> {
  resolved: ResolvedPartialTempConflict<ASTData, Kinds>[];
  callback?: Callback<ASTData, Kinds>;
  rejecter?: Condition<ASTData, Kinds>;
  rollback?: Callback<ASTData, Kinds>;
  commit?: Condition<ASTData, Kinds>;
  traverser?: Traverser<ASTData, Kinds>;
}
