import { ILexer } from "../../../lexer";
import { IParser } from "../../model";
import {
  Definition,
  DefinitionContextBuilder,
  RR_ResolverOptions,
  RS_ResolverOptions,
} from "../builder";

export type BuildOptions = {
  debug?: boolean;
  generateResolvers?: "builder" | "context";
  /** If `printAll` is true, print all errors instead of throwing errors. */
  printAll?: boolean;
  checkSymbols?: boolean;
  checkConflicts?: boolean;
  checkAll?: boolean;
};

export interface IParserBuilder<T> {
  entry(...defs: string[]): this;
  define(defs: Definition, ctxBuilder?: DefinitionContextBuilder<T>): this;
  build(lexer: ILexer, options?: BuildOptions): IParser<T>;
  resolveRS(
    reducerRule: Definition,
    anotherRule: Definition,
    options: RS_ResolverOptions<T>
  ): this;
  resolveRR(
    reducerRule: Definition,
    anotherRule: Definition,
    options: RR_ResolverOptions<T>
  ): this;
}
