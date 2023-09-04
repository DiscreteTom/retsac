import { Traverser } from "../../../ast";
import { Callback, Condition } from "../../model";
import { ResolvedPartialTempConflict } from "./resolver";

export type Definition<Kinds extends string> = {
  [NT in Kinds]?: string | string[];
};

export interface DefinitionContext<T, Kinds extends string> {
  resolved: ResolvedPartialTempConflict<T, Kinds>[];
  callback?: Callback<T, Kinds>;
  rejecter?: Condition<T, Kinds>;
  rollback?: Callback<T, Kinds>;
  commit?: Condition<T, Kinds>;
  traverser?: Traverser<T, Kinds>;
}
