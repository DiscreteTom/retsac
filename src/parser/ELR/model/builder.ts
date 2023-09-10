import { ILexer } from "../../../lexer";
import { IParser } from "../../model";
import {
  Definition,
  DefinitionContextBuilder,
  RR_ResolverOptions,
  RS_ResolverOptions,
} from "../builder";

// type only import for js doc
import type { Parser } from "../parser";

export type BuildOptions = Partial<
  Pick<IParser<any, any>, "logger" | "debug">
> & {
  /**
   * Which format to generate resolvers.
   * If `undefined`, resolvers will not be generated.
   *
   * @default undefined
   */
  generateResolvers?: "builder" | "context";
  /**
   * If `true`, print all errors instead of throwing errors during the build process.
   * @default false
   */
  printAll?: boolean;
  /**
   * @default false
   */
  checkSymbols?: boolean;
  /**
   * @default false
   */
  checkConflicts?: boolean;
  /**
   * Short for {@link BuildOptions.checkSymbols} `&&` {@link BuildOptions.checkConflicts} `&&` {@link BuildOptions.checkRollback}.
   * @default false
   */
  checkAll?: boolean;
  /**
   * If `true`, {@link DefinitionContextBuilder.rollback} will be effective.
   * @default false to optimize performance.
   */
  rollback?: boolean;
  /**
   * If `true`, check if you defined rollback actions but {@link BuildOptions.rollback} is `false`.
   * @default false
   */
  checkRollback?: boolean;
  /**
   * If `true`, the parser will try to re-lex the input.
   * @default true
   */
  reLex?: boolean;
  /**
   * If `true` and the build is successful, {@link IParserBuilder.serializable} will be set.
   * @default false
   */
  serialize?: boolean;
  /**
   * If provided and valid, the parser will be hydrated from this data.
   * The value is always checked to make sure it's valid.
   */
  hydrate?: SerializableParserData;
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
   * Generate the {@link Parser ELR Parser}.
   */
  build<LexerKinds extends string>(
    // lexer's error type is not important yet, since we don't need token's error in parser's output.
    // if user wants to get lexer's errors, they can use `lexer.errors`.
    lexer: ILexer<any, LexerKinds>,
    options?: BuildOptions
  ): IParser<ASTData, Kinds | LexerKinds>;
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
  /**
   * If you build the parser with {@link BuildOptions.serialize},
   * this property will be set to the serializable object.
   */
  get serializable(): Readonly<SerializableParserData> | undefined;
  // /**
  //  * Restore the parser from a serializable object.
  //  */
  // hydrate(
  //   data: SerializableParserData,
  //   options?: Pick<
  //     BuildOptions,
  //     "debug" | "logger" | "printAll" | "reLex" | "rollback"
  //   >
  // ): ReturnType<this["build"]>;
}

export type BuilderDecorator<
  ASTData,
  Kinds extends string,
  Append extends string
> = (
  pb: IParserBuilder<ASTData, Kinds>
) => IParserBuilder<ASTData, Kinds | Append>; // return `this`

/**
 * Used to store the parser to a serializable object.
 */
export type SerializableParserData = {
  /**
   * The meta data for hydrating the parser.
   * If meta data mismatch, the parser builder will reject to hydrate.
   */
  // meta: string; // do we need to check meta?
  data: { [key: string]: any }; // TODO: type this
};
