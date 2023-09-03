import { Traverser } from "../../../ast";
import { Callback, Condition } from "../../model";
import { ResolvedPartialTempConflict } from "./resolver";

export interface Definition {
  [NT: string]: string | string[];
}

export interface DefinitionContext<T> {
  resolved: ResolvedPartialTempConflict<T>[];
  callback?: Callback<T>;
  rejecter?: Condition<T>;
  rollback?: Callback<T>;
  commit?: Condition<T>;
  traverser?: Traverser<T>;
}
