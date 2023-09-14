import type { ILexer } from "../../../lexer";
import type { IParser } from "../../model";
import type { DFA } from "../DFA";
import type {
  Definition,
  DefinitionContextBuilder,
  RR_ResolverOptions,
  RS_ResolverOptions,
} from "../builder";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Parser } from "../parser";

export type BuildOptions<
  Kinds extends string,
  LexerKinds extends string,
> = Partial<
  Pick<IParser<never, never, Kinds, LexerKinds, never>, "logger" | "debug">
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
   * If the {@link BuildOptions.hydrate} is set, the {@link IParserBuilder.serializable} will be set to that
   * instead of generating a new one.
   * @default false
   */
  serialize?: boolean;
  /**
   * If provided and valid, the parser will be hydrated from this data.
   * The value is always checked to make sure it's valid.
   */
  hydrate?: SerializableParserData<Kinds, LexerKinds>;
};

export interface IParserBuilder<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> {
  /**
   * Declare top-level NT's.
   * This is required for ELR parser.
   * You should call this only once. If you call this multiple times, the last one will be used.
   */
  entry(
    ...defs: Kinds[]
  ): IParserBuilder<ASTData, ErrorType, Kinds, LexerKinds, LexerError>;
  /**
   * Declare grammar rules.
   */
  define<Append extends string>(
    defs: Definition<Kinds | Append>,
    ...ctxBuilders: DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds | Append,
      LexerKinds
    >[]
  ): IParserBuilder<ASTData, ErrorType, Kinds | Append, LexerKinds, LexerError>;
  /**
   * Generate the {@link Parser ELR Parser}.
   * This won't modify the builder, so you can call this multiple times.
   */
  build(
    // lexer's error type is not important yet, since we don't need token's error in parser's output.
    // if user wants to get lexer's errors, they can use `lexer.errors`.
    lexer: ILexer<LexerError, LexerKinds>,
    options?: BuildOptions<Kinds, LexerKinds>,
  ): {
    parser: IParser<ASTData, ErrorType, Kinds, LexerKinds, LexerError>;
    /**
     * If you build the parser with {@link BuildOptions.serialize},
     * this will be set to the serializable object.
     */
    serializable?: Readonly<SerializableParserData<Kinds, LexerKinds>>;
  };
  /**
   * Resolve a reduce-shift conflict.
   */
  resolveRS(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>,
  ): this;
  /**
   * Resolve a reduce-reduce conflict.
   */
  resolveRR(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>,
  ): this;
  /**
   * Apply a function to this builder.
   */
  use<
    AppendKinds extends string,
    AppendLexerKinds extends string,
    AppendError,
    AppendLexerError,
  >(
    f: BuilderDecorator<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      AppendKinds,
      AppendLexerKinds,
      AppendError,
      AppendLexerError
    >,
  ): IParserBuilder<
    ASTData,
    ErrorType | AppendError,
    Kinds | AppendKinds,
    LexerKinds | AppendLexerKinds,
    LexerError | AppendLexerError
  >;
  /**
   * Append lexer's kinds to the parser kinds, and append lexer's error type to the parser lexer's error type.
   *
   * This function will do nothing but set the generic type parameter of the parser builder in TypeScript.
   * So this function is only useful in TypeScript.
   */
  useLexer<AppendLexerKinds extends string, AppendLexerError>(
    lexer: ILexer<AppendLexerError, AppendLexerKinds>,
  ): IParserBuilder<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds | AppendLexerKinds,
    LexerError | AppendLexerError
  >;
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
  // TODO: update comments
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
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  AppendKinds extends string,
  AppendLexerKinds extends string,
  AppendError,
  AppendLexerError,
> = (
  pb: IParserBuilder<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
) => IParserBuilder<
  ASTData,
  ErrorType | AppendError,
  Kinds | AppendKinds,
  LexerKinds | AppendLexerKinds,
  LexerError | AppendLexerError
>;

/**
 * Used to store the parser to a serializable object.
 */
export type SerializableParserData<
  Kinds extends string,
  LexerKinds extends string,
> = {
  // TODO: add meta
  // /**
  //  * The meta data for hydrating the parser.
  //  * If meta data mismatch, the parser builder will reject to hydrate.
  //  */
  // meta: string; // do we need to check meta?
  data: {
    dfa: ReturnType<DFA<never, never, Kinds, LexerKinds, never>["toJSON"]>;
  };
};
