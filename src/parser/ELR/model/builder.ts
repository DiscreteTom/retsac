import type { ILexer } from "../../../lexer";
import type { IParser } from "../../model";
import type { DFA } from "../DFA";
import type {
  Definition,
  DefinitionContextBuilder,
  DefinitionGroupWithAssociativity,
  RR_ResolverOptions,
  RS_ResolverOptions,
} from "../builder";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Parser } from "../parser";

export type BuildOptions<
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = Partial<
  Pick<IParser<never, never, Kinds, LexerKinds, never>, "logger" | "debug">
> & {
  lexer: ILexer<LexerError, LexerKinds>;
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
   * If `true` and the build is successful, {@link IParserBuilder.build} will return a serializable object.
   * If the {@link BuildOptions.hydrate} is set, the serializable will be set to that directly
   * instead of generating a new one.
   * @default false
   */
  serialize?: boolean;
  /**
   * If provided and valid, the parser will be hydrated from this data.
   * The value is always checked to make sure it's valid.
   */
  hydrate?: SerializableParserData<Kinds, LexerKinds>;
  /**
   * If `true` and the build is successful, {@link IParserBuilder.build} will return a mermaid graph.
   * @default false
   */
  mermaid?: boolean;
  /**
   * If `true`, when an entry NT is reduced, the parser will accept it immediately
   * without checking the entry NT's follow set.
   *
   * @default false
   */
  // TODO: rename rename this to a more intuitive name
  // TODO: add tests for this
  ignoreEntryFollow?: boolean;
  // TODO: autoCommitEntry?
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
   * Define grammar rules.
   */
  define<Append extends string>(
    defs: Definition<Kinds | Append>,
    ...ctxBuilders: DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds | Append,
      LexerKinds,
      LexerError
    >[]
  ): IParserBuilder<ASTData, ErrorType, Kinds | Append, LexerKinds, LexerError>;
  /**
   * Generate the {@link Parser ELR Parser}.
   * This won't modify the builder, so you can call this multiple times.
   */
  build<AppendLexerKinds extends string, AppendLexerError>(
    options: BuildOptions<
      Kinds,
      LexerKinds | AppendLexerKinds,
      LexerError | AppendLexerError
    >,
  ): {
    parser: IParser<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds | AppendLexerKinds,
      LexerError | AppendLexerError
    >;
    /**
     * If you build the parser with {@link BuildOptions.serialize},
     * this will be set to the serializable object.
     */
    serializable?: Readonly<
      SerializableParserData<Kinds, LexerKinds | AppendLexerKinds>
    >;
    mermaid?: string;
  };
  /**
   * Resolve a reduce-shift conflict.
   */
  resolveRS(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RS_ResolverOptions<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
  ): this;
  /**
   * Resolve a reduce-reduce conflict.
   */
  resolveRR(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RR_ResolverOptions<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
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
   * Grammar rules with higher priority will always be accepted first.
   *
   * For those grammar rules with the same priority, the associativity will be used.
   * The default associativity is left-to-right.
   *
   * @example
   * builder.priority(
   *   { exp: `'-' exp` }, // highest priority
   *   [{ exp: `exp '*' exp` }, { exp: `exp '/' exp` }],
   *   [{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }], // lowest priority
   * )
   * // if you need right-to-left associativity, you can use `ELR.rightToLeft`:
   * builder.priority(ELR.rightToLeft({ exp: `exp '**' exp` }))
   */
  priority(
    ...groups: (
      | Definition<Kinds>
      | Definition<Kinds>[]
      | DefinitionGroupWithAssociativity<Kinds>
    )[]
  ): this;
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
