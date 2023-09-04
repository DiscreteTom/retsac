import { ILexer } from "../../../lexer";
import { IParser } from "../../model";
import {
  Definition,
  DefinitionContextBuilder,
  RR_ResolverOptions,
  RS_ResolverOptions,
} from "../builder";

export type BuildOptions = Partial<
  Pick<IParser<any, any>, "logger" | "debug">
> & {
  /**
   * Which format to generate resolvers.
   * If `undefined`, resolvers will not be generated.
   *
   * Default: `undefined`.
   */
  generateResolvers?: "builder" | "context";
  /**
   * If `printAll` is true, print all errors instead of throwing errors.
   *
   * Default: `false`.
   */
  printAll?: boolean;
  /**
   * Default: `false`.
   */
  checkSymbols?: boolean;
  /**
   * Default: `false`.
   */
  checkConflicts?: boolean;
  /**
   * Short for `checkSymbols` and `checkConflicts`.
   *
   * Default: `false`.
   */
  checkAll?: boolean;
  /**
   * If `true`, the `rollback` in `DefinitionContextBuilder` will be used.
   *
   * Default: `false` to optimize performance.
   */
  rollback?: boolean;
  /**
   * If `true`, the parser will try to re-lex the input.
   *
   * Default: `true`.
   */
  reLex?: boolean;
};

export interface IParserBuilder<ASTData, Kinds extends string> {
  /**
   * Declare top-level NT's.
   * This is required for ELR parser.
   * You should call this only once. If you call this multiple times, the last one will be used.
   */
  entry<Append extends string>(
    ...defs: Append[]
  ): IParserBuilder<ASTData, Kinds | Append>;
  /**
   * Declare grammar rules.
   */
  define<Append extends string>(
    defs: Definition<Kinds | Append>,
    ctxBuilder?: DefinitionContextBuilder<ASTData, Kinds | Append>
  ): IParserBuilder<ASTData, Kinds | Append>;
  /**
   * Generate the ELR parser.
   */
  build<LexerKinds extends string>(
    lexer: ILexer<any, LexerKinds>,
    options?: BuildOptions
  ): IParser<ASTData, Kinds | LexerKinds>; // TODO: use generic type
  /**
   * Resolve a reduce-shift conflict.
   */
  resolveRS(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, Kinds>
  ): this;
  /**
   * Resolve a reduce-reduce conflict.
   */
  resolveRR(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, Kinds>
  ): this;
  /**
   * Apply a function to this builder.
   */
  use<Append extends string>(
    f: BuilderDecorator<ASTData, Kinds, Append>
  ): IParserBuilder<ASTData, Kinds | Append>;
  /**
   * Generate resolvers by grammar rules' priorities.
   *
   * ```ts
   * // gr1 > gr2 = gr3
   * builder.priority(gr1, [gr2, gr3])
   * ```
   *
   * Grammar rules with higher priority will always be accepted first,
   * and grammar rules with the same priority will be accepted according to the order of definition you provided here.
   */
  priority(...defs: (Definition<Kinds> | Definition<Kinds>[])[]): this;
  /**
   * Generate resolvers to make these definitions left-self-associative.
   *
   * ```ts
   * // `1 - 2 - 3` means `(1 - 2) - 3` instead of `1 - (2 - 3)`
   * builder.leftSA({ exp: `exp '-' exp` })
   * ```
   */
  leftSA(...defs: Definition<Kinds>[]): this;
  /**
   * Generate resolvers to make these definitions right-self-associative.
   * ```ts
   * // `a = b = 1` means `a = (b = 1)` instead of `(a = b) = 1`
   * builder.rightSA({ exp: `var '=' exp` })
   * ```
   */
  rightSA(...defs: Definition<Kinds>[]): this;
}

export type BuilderDecorator<
  ASTData,
  Kinds extends string,
  Append extends string
> = (
  pb: IParserBuilder<ASTData, Kinds>
) => IParserBuilder<ASTData, Kinds | Append>; // return `this`
