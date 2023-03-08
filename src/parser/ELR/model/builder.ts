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
  /** Declare top-level NT's. */
  entry(...defs: string[]): this;
  define(defs: Definition, ctxBuilder?: DefinitionContextBuilder<T>): this;
  /** Generate the ELR parser. */
  build(lexer: ILexer, options?: BuildOptions): IParser<T>;
  /** Resolve a reduce-shift conflict. */
  resolveRS(
    reducerRule: Definition,
    anotherRule: Definition,
    options: RS_ResolverOptions<T>
  ): this;
  /** Resolve a reduce-reduce conflict. */
  resolveRR(
    reducerRule: Definition,
    anotherRule: Definition,
    options: RR_ResolverOptions<T>
  ): this;
  use(f: BuilderDecorator<T>): this;
  priority(...defs: Definition[][]): this;
  /** Mark these definitions left-self-associative. */
  leftSA(...defs: Definition[]): this;
  /** Mark these definitions right-self-associative. */
  rightSA(...defs: Definition[]): this;
}

export type BuilderDecorator<T> = (pb: IParserBuilder<T>) => IParserBuilder<T>; // return `this`
