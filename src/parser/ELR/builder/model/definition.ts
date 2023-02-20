import { Traverser } from "../../../model";
import { Callback, Condition } from "../../model";
import { TempPartialConflict } from "./conflict";

export interface Definition {
  [NT: string]: string | string[];
}

export interface DefinitionContext<T> {
  callback: Callback<T>;
  rejecter: Condition<T>;
  resolved: TempPartialConflict<T>[];
  rollback: Callback<T>;
  commit: Condition<T>;
  traverser?: Traverser<T>;
}
