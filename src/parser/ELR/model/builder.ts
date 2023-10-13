import type { ILexer, IReadonlyLexer } from "../../../lexer";
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
  LexerActionState,
> = Partial<
  Pick<
    IParser<never, never, Kinds, LexerKinds, never, LexerActionState>,
    "logger" | "debug" | "autoCommit" | "ignoreEntryFollow"
  >
> & {
  /**
   * Declare top-level NT's.
   * This is required for ELR parser.
   */
  entry: Kinds | readonly Kinds[];
  lexer: ILexer<LexerError, LexerKinds, LexerActionState>;
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
   * Short for {@link BuildOptions.checkSymbols} `&&` {@link BuildOptions.checkConflicts} `&&` {@link BuildOptions.checkRollback} `&&` {@link BuildOptions.checkHydrate}.
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
   * If `true`, the parser will check the hash of the serialized parser data before hydrate.
   * @default false
   */
  checkHydrate?: boolean;
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
};

export interface IParserBuilder<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> {
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
      LexerError,
      LexerActionState
    >[]
  ): IParserBuilder<
    ASTData,
    ErrorType,
    Kinds | Append,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  /**
   * Generate the {@link Parser ELR Parser}.
   * This won't modify the builder, so you can call this multiple times.
   */
  // TODO: overload this to make sure serializable is set if serialize is true? same to mermaid & resolvers
  build<
    AppendLexerKinds extends string,
    AppendLexerError,
    AppendLexerActionState,
  >(
    options: BuildOptions<
      Kinds,
      LexerKinds | AppendLexerKinds,
      LexerError | AppendLexerError,
      LexerActionState | AppendLexerActionState
    >,
  ): {
    parser: IParser<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds | AppendLexerKinds,
      LexerError | AppendLexerError,
      LexerActionState | AppendLexerActionState
    >;
    /**
     * If you build the parser with {@link BuildOptions.serialize},
     * this will be set to the serializable object.
     */
    serializable?: Readonly<
      SerializableParserData<Kinds, LexerKinds | AppendLexerKinds>
    >;
    mermaid?: string;
    /**
     * If you build the parser with {@link BuildOptions.generateResolvers},
     * this will be set to the generated resolver string.
     */
    resolvers?: string;
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
      LexerError,
      LexerActionState
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
      LexerError,
      LexerActionState
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
    AppendLexerActionState,
  >(
    f: BuilderDecorator<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState,
      AppendKinds,
      AppendLexerKinds,
      AppendError,
      AppendLexerError,
      AppendLexerActionState
    >,
  ): IParserBuilder<
    ASTData,
    ErrorType | AppendError,
    Kinds | AppendKinds,
    LexerKinds | AppendLexerKinds,
    LexerError | AppendLexerError,
    LexerActionState | AppendLexerActionState
  >;
  /**
   * Append lexer's kinds to the parser kinds, and append lexer's error type to the parser lexer's error type.
   *
   * This function will do nothing but set the generic type parameter of the parser builder in TypeScript.
   * So this function is only useful in TypeScript.
   */
  useLexer<
    AppendLexerKinds extends string,
    AppendLexerError,
    AppendLexerActionState,
  >(
    lexer: IReadonlyLexer<
      AppendLexerError,
      AppendLexerKinds,
      AppendLexerActionState
    >,
  ): IParserBuilder<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds | AppendLexerKinds,
    LexerError | AppendLexerError,
    LexerActionState | AppendLexerActionState
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
  LexerActionState,
  AppendKinds extends string,
  AppendLexerKinds extends string,
  AppendError,
  AppendLexerError,
  AppendLexerActionState,
> = (
  pb: IParserBuilder<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >,
) => IParserBuilder<
  ASTData,
  ErrorType | AppendError,
  Kinds | AppendKinds,
  LexerKinds | AppendLexerKinds,
  LexerError | AppendLexerError,
  LexerActionState | AppendLexerActionState
>;

/**
 * Used to store the parser to a serializable object.
 */
export type SerializableParserData<
  Kinds extends string,
  LexerKinds extends string,
> = {
  /**
   * The hash of the parser.
   * If {@link BuildOptions} the hash mismatch, the parser builder will reject to hydrate.
   */
  hash: number;
  data: {
    dfa: ReturnType<
      DFA<never, never, Kinds, LexerKinds, never, never>["toJSON"]
    >;
  };
};
