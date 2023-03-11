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
  /** Apply a function to this builder. */
  use(f: BuilderDecorator<T>): this;
  /**
   * Generate resolvers to implement grammar rules' priorities.
   *
   * ```ts
   * // gr1 > gr2 = gr3
   * builder.priority(gr1, [gr2, gr3])
   * ```
   */
  priority(...defs: (Definition | Definition[])[]): this;
  /**
   * Generate resolvers to make these definitions left-self-associative.
   *
   * ```ts
   * // 1 - 2 - 3 means (1 - 2) - 3 instead of 1 - (2 - 3)
   * builder.leftSA({ exp: `exp '-' exp` })
   * ```
   */
  leftSA(...defs: Definition[]): this;
  /**
   * Generate resolvers to make these definitions right-self-associative.
   * ```ts
   * // a = b = 1 means a = (b = 1) instead of (a = b) = 1
   * builder.rightSA({ exp: `var '=' exp` })
   * ```
   */
  rightSA(...defs: Definition[]): this;
}

export type BuilderDecorator<T> = (pb: IParserBuilder<T>) => IParserBuilder<T>; // return `this`
