import type { GeneralTokenDataBinding, IReadonlyLexer } from "../../../lexer";
import type { IParser } from "../../model";
import type { DFA } from "../DFA";
import type {
  Definition,
  DefinitionContextBuilderDecorator,
  DefinitionGroupWithAssociativity,
  RR_ResolverOptions,
  RS_ResolverOptions,
} from "../builder";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Parser } from "../parser";

export type BuildOptions<
  NTs extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
> = [LexerDataBindings] extends [never]
  ? never // no lexer, prevent build
  : Partial<
      Pick<
        IParser<
          string,
          never,
          never,
          GeneralTokenDataBinding,
          never,
          never,
          never
        >,
        "logger" | "debug" | "autoCommit" | "ignoreEntryFollow"
      >
    > & {
      /**
       * Declare top-level NT's.
       * This is required for ELR parser.
       */
      entry: NTs | readonly NTs[];
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
      hydrate?: SerializableParserData<NTs, LexerDataBindings>;
      /**
       * If `true` and the build is successful, {@link IParserBuilder.build} will return a mermaid graph.
       * @default false
       */
      mermaid?: boolean;
    };

export type BuildOutput<
  LexerDataBindings extends GeneralTokenDataBinding,
  NTs extends string,
  ASTData,
  ErrorType,
  LexerActionState,
  LexerErrorType,
  Global,
> = {
  parser: [LexerDataBindings] extends [never]
    ? never // if no lexer, no parser
    : IParser<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >;
  /**
   * If you build the parser with {@link BuildOptions.serialize},
   * this will be set to the serializable object.
   */
  serializable?: Readonly<SerializableParserData<NTs, LexerDataBindings>>;
  mermaid?: string;
  /**
   * If you build the parser with {@link BuildOptions.generateResolvers},
   * this will be set to the generated resolver string.
   */
  resolvers?: string;
};

// TODO: add TraverseContext as a generic type parameter
export interface IParserBuilder<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> {
  /**
   * Set the lexer. The lexer won't be modified.
   * When build the parser, the lexer will be cloned to make sure the builder is not modified.
   *
   * This function must and can only be called once and must be called before defining any grammar rules.
   * @example
   * const lexer = new Lexer.Builder().build();
   * new ELR.ParserBuilder().lexer(lexer).define(...).build({...});
   */
  // TODO: allow multiple call
  lexer<
    // make sure this function can only be called once
    // and must be called before defining any grammar rules
    NewLexerDataBindings extends [NTs] extends [never]
      ? [LexerDataBindings] extends [never] // why array? see [[@type constraints with array]]
        ? GeneralTokenDataBinding // NewLexerDataBindings should extends GeneralTokenDataBinding
        : never // LexerDataBindings already set, prevent modification
      : never, // prevent setting LexerDataBindings after Kinds is defined
    NewLexerActionState,
    NewLexerErrorType,
  >(
    lexer: IReadonlyLexer<
      NewLexerDataBindings,
      NewLexerActionState,
      NewLexerErrorType
    >,
  ): IParserBuilder<
    NTs,
    ASTData,
    ErrorType,
    NewLexerDataBindings,
    NewLexerActionState,
    NewLexerErrorType,
    Global
  >;
  /**
   * Set the `ASTNode.data` type.
   *
   * This function can only be called once and must be called before defining any grammar rules.
   * @example
   * // provide type explicitly
   * builder.data<number>();
   * // infer type from a value
   * builder.data({ a: 1 });
   */
  // TODO: allow multiple call
  data<
    NewASTData extends [NTs] extends [never]
      ? [ASTData] extends [never] // why array? see [[@type constraints with array]]
        ? unknown // NewData can be any type
        : never // ASTData already set, prevent modification
      : never, // prevent setting ASTData after Kinds is defined
  >(
    data?: NewASTData,
  ): IParserBuilder<
    NTs,
    NewASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  /**
   * Define grammar rules.
   */
  define<Append extends string>(
    defs: Definition<NTs | Append>,
    decorator?: DefinitionContextBuilderDecorator<
      NTs | Append,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ): IParserBuilder<
    NTs | Append,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  /**
   * Resolve a reduce-shift conflict.
   */
  resolveRS(
    reducerRule: Definition<NTs>,
    anotherRule: Definition<NTs>,
    options: RS_ResolverOptions<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ): this;
  /**
   * Resolve a reduce-reduce conflict.
   */
  resolveRR(
    reducerRule: Definition<NTs>,
    anotherRule: Definition<NTs>,
    options: RR_ResolverOptions<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ): this;
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
      | Definition<NTs>
      | Definition<NTs>[]
      | DefinitionGroupWithAssociativity<NTs>
    )[]
  ): this;
  /**
   * Apply a function to this builder.
   */
  use<AppendKinds extends string>(
    f: BuilderDecorator<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global,
      AppendKinds
    >,
  ): IParserBuilder<
    NTs | AppendKinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  /**
   * Generate the {@link Parser ELR Parser}.
   * This won't modify the builder, so you can call this multiple times.
   */
  // TODO: overload this to make sure serializable is set if serialize is true? same to mermaid & resolvers
  build(
    options: BuildOptions<NTs, LexerDataBindings>,
  ): BuildOutput<
    LexerDataBindings,
    NTs,
    ASTData,
    ErrorType,
    LexerActionState,
    LexerErrorType,
    Global
  >;
}

export type BuilderDecorator<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
  AppendKinds extends string,
> = (
  pb: IParserBuilder<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
) => IParserBuilder<
  NTs | AppendKinds,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType,
  Global
>;

/**
 * Used to store the parser to a serializable object.
 */
export type SerializableParserData<
  NTs extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
> = {
  /**
   * The hash of the parser.
   * If {@link BuildOptions} the hash mismatch, the parser builder will reject to hydrate.
   */
  hash: number;
  data: {
    dfa: ReturnType<
      DFA<NTs, never, never, LexerDataBindings, never, never, never>["toJSON"]
    >;
  };
};

export type ExtractSerializableParserData<
  ParserBuilder extends {
    build(...params: unknown[]): { serializable?: unknown };
  },
> = NonNullable<ReturnType<ParserBuilder["build"]>["serializable"]>;
