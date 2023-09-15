import type { ILexer } from "../../../lexer";
import type { Logger } from "../../../logger";
import type {
  Definition,
  ParserBuilderData,
  RR_ResolverOptions,
  RS_ResolverOptions,
} from "../builder";
import { DefinitionContextBuilder } from "../builder";
import { ParserBuilder } from "../builder";
import type { BuildOptions, IParserBuilder } from "../model";
import { GrammarExpander } from "./utils/advanced-grammar-parser";

export class AdvancedBuilder<
    ASTData,
    ErrorType = unknown,
    Kinds extends string = never,
    LexerKinds extends string = never,
    LexerError = never,
  >
  extends ParserBuilder<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
  implements IParserBuilder<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
{
  private readonly expander: GrammarExpander<Kinds, LexerKinds>;

  // user defined data & conflicts will be stored here first
  // before passing to the super class
  // because we may need to expand the definitions
  // and send them to a new parser builder
  private readonly _data: ParserBuilderData<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds
  >[] = [];
  private readonly resolvedRS: {
    reducerRule: Definition<Kinds>;
    anotherRule: Definition<Kinds>;
    options: RS_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;
  }[];
  private readonly resolvedRR: {
    reducerRule: Definition<Kinds>;
    anotherRule: Definition<Kinds>;
    options: RR_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;
  }[];

  constructor(options?: {
    /**
     * Prefix of the generated placeholder grammar rules.
     * This will also be used as the cascade query prefix.
     */
    prefix?: string;
  }) {
    const prefix = options?.prefix ?? `__`;
    super({ cascadeQueryPrefix: prefix });
    this.expander = new GrammarExpander<Kinds, LexerKinds>({
      placeholderPrefix: prefix,
    });
    this._data = [];
    this.resolvedRS = [];
    this.resolvedRR = [];
  }

  // intercept the super.define() method
  define<Append extends string>(
    defs: Definition<Kinds | Append>,
    ...ctxBuilders: DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds | Append,
      LexerKinds
    >[]
  ): IParserBuilder<
    ASTData,
    ErrorType,
    Kinds | Append,
    LexerKinds,
    LexerError
  > {
    (
      this._data as ParserBuilderData<
        ASTData,
        ErrorType,
        Kinds | Append,
        LexerKinds
      >[]
    ).push({
      defs,
      ctxBuilder: DefinitionContextBuilder.reduce(ctxBuilders),
    });
    return this as IParserBuilder<
      ASTData,
      ErrorType,
      Kinds | Append,
      LexerKinds,
      LexerError
    >;
  }

  private expand(
    d: Definition<Kinds>,
    debug: boolean,
    logger: Logger,
    resolve: boolean,
    cb: (res: {
      defs: Definition<Kinds>[];
      rs: {
        reducerRule: Definition<Kinds>;
        anotherRule: Definition<Kinds>;
        options: RS_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;
      }[];
    }) => void,
  ) {
    for (const NT in d) {
      const def = d[NT];
      const defStr = def instanceof Array ? def.join("|") : (def as string);
      const res = this.expander.expand<ASTData, ErrorType>(
        defStr,
        NT,
        debug,
        logger,
        resolve,
      );
      cb(res);
    }
  }

  build<AppendLexerKinds extends string, AppendLexerError>(
    lexer: ILexer<AppendLexerError, AppendLexerKinds>,
    options?: BuildOptions<Kinds, LexerKinds | AppendLexerKinds>,
  ) {
    // if hydrate, just call super.build()
    if (options?.hydrate !== undefined) return super.build(lexer, options);

    const debug = options?.debug ?? false;
    const logger = options?.logger ?? console.log;

    // generate a new parser builder to prevent side effects
    const builder = new ParserBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >({
      cascadeQueryPrefix: this.cascadeQueryPrefix,
    });
    builder.entry(...this.entryNTs);

    // expand definitions in data
    this._data.forEach(({ defs, ctxBuilder }) => {
      this.expand(defs, debug, logger, true, (res) => {
        res.defs.forEach((def) => {
          // TODO: we need hydration id here
          if (ctxBuilder === undefined) builder.define(def);
          else builder.define(def, ctxBuilder);
        });
        res.rs.forEach((r) =>
          // TODO: don't use builder.resolveRS, will cause hydration error
          // we need to add hydration id to the resolvedRS
          builder.resolveRS(r.reducerRule, r.anotherRule, r.options),
        );
      });
    });

    // expand definitions in resolvers
    this.resolvedRS.forEach((rc) => {
      const reducerRules: Definition<Kinds>[] = [];
      const anotherRules: Definition<Kinds>[] = [];
      this.expand(rc.reducerRule, false, logger, false, (res) => {
        reducerRules.push(...res.defs);
      });
      this.expand(rc.anotherRule, false, logger, false, (res) => {
        anotherRules.push(...res.defs);
      });
      reducerRules.forEach((r) => {
        anotherRules.forEach((a) => {
          // TODO: with hydration id
          builder.resolveRS(r, a, rc.options);
        });
      });
    });
    this.resolvedRR.forEach((rc) => {
      const reducerRules: Definition<Kinds>[] = [];
      const anotherRules: Definition<Kinds>[] = [];
      this.expand(rc.reducerRule, false, logger, false, (res) => {
        reducerRules.push(...res.defs);
      });
      this.expand(rc.anotherRule, false, logger, false, (res) => {
        anotherRules.push(...res.defs);
      });
      reducerRules.forEach((r) => {
        anotherRules.forEach((a) => {
          // TODO: with hydration id
          builder.resolveRR(r, a, rc.options);
        });
      });
    });

    // generate placeholder grammar rules
    const res = this.expander.generatePlaceholderGrammarRules<
      ASTData,
      ErrorType
    >(debug, logger);
    res.defs.forEach((def) => builder.define(def));
    res.rs.forEach((r) =>
      // hydration id is not needed here
      // since the accepter in r.options is boolean and can be serialized
      builder.resolveRS(r.reducerRule, r.anotherRule, r.options),
    );

    return builder.build(lexer, options);
  }

  // these 2 methods will also intercept the super.priority() method
  resolveRS(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>,
  ) {
    this.resolvedRS.push({ reducerRule, anotherRule, options });
    return this;
  }
  resolveRR(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>,
  ) {
    this.resolvedRR.push({ reducerRule, anotherRule, options });
    return this;
  }
}
