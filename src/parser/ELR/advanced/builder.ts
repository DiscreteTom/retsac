import type { ILexer } from "../../../lexer";
import type { Logger } from "../../../logger";
import type {
  Definition,
  ParserBuilderData,
  RS_ResolverOptions,
} from "../builder";
import { DefinitionContextBuilder, ParserBuilder } from "../builder";
import type { BuildOptions, IParserBuilder } from "../model";
import { ConflictType } from "../model";
import { GrammarExpander } from "./utils/grammar-expander";

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
  }

  private expand(
    d: Definition<Kinds>,
    debug: boolean,
    logger: Logger,
    /**
     * Whether to auto resolve R-S conflict.
     */
    resolve: boolean,
  ) {
    const res = [] as {
      defs: Definition<Kinds>[];
      rs: {
        reducerRule: Definition<Kinds>;
        anotherRule: Definition<Kinds>;
        options: RS_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;
      }[];
    }[];
    for (const NT in d) {
      const def = d[NT];
      const defStr = def instanceof Array ? def.join("|") : (def as string);
      res.push(
        this.expander.expand<ASTData, ErrorType>(
          defStr,
          NT,
          debug,
          logger,
          resolve,
        ),
      );
    }
    return res;
  }

  build<AppendLexerKinds extends string, AppendLexerError>(
    lexer: ILexer<AppendLexerError, AppendLexerKinds>,
    options?: BuildOptions<Kinds, LexerKinds | AppendLexerKinds>,
  ) {
    // if hydrate, just call super.build()
    // since all data needed for build is in super.data
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
    const toBeLoaded = [] as ParserBuilderData<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds
    >[];
    this.data.forEach(({ defs, ctxBuilder, resolveOnly, hydrationId }) => {
      // first, expand another rules in ctx.resolvers if exists
      const ctx = ctxBuilder?.build();
      const expandedCtxBuilder = new DefinitionContextBuilder<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds
      >();
      ctx?.resolved.forEach((r) => {
        // for another rule, we don't need to log debug info or auto resolve R-S conflict
        this.expand(r.anotherRule, false, logger, false).forEach((res) => {
          res.defs.forEach((d) => {
            if (r.type == ConflictType.REDUCE_SHIFT) {
              expandedCtxBuilder.resolveRS(d, r.options);
            } else {
              expandedCtxBuilder.resolveRR(d, r.options);
            }
          });
        });
      });
      // assign other ctx builder fields
      if (ctx?.callback !== undefined)
        expandedCtxBuilder.callback(ctx.callback);
      if (ctx?.rejecter !== undefined)
        expandedCtxBuilder.rejecter(ctx.rejecter);
      if (ctx?.rollback !== undefined)
        expandedCtxBuilder.rollback(ctx.rollback);
      if (ctx?.commit !== undefined) expandedCtxBuilder.commit(ctx.commit);
      if (ctx?.traverser !== undefined)
        expandedCtxBuilder.traverser(ctx.traverser);

      // now we can expand definitions
      this.expand(defs, debug, logger, true).forEach((res) => {
        res.defs.forEach((def) => {
          toBeLoaded.push({
            defs: def,
            ctxBuilder: expandedCtxBuilder,
            resolveOnly,
            hydrationId,
          });
        });
        // append generated rs resolver
        res.rs.forEach((r) => {
          toBeLoaded.push({
            defs: r.reducerRule,
            ctxBuilder: DefinitionContextBuilder.resolveRS(
              r.anotherRule,
              r.options,
            ),
            resolveOnly: true,
            hydrationId, // the hydration id does not matter, since the generated resolvers are serializable
          });
        });
      });
    });
    builder.load(toBeLoaded);

    // generate placeholder grammar rules
    // hydration id does not matter here
    // since generated resolvers are serializable
    const res = this.expander.generatePlaceholderGrammarRules<
      ASTData,
      ErrorType
    >(debug, logger);
    res.defs.forEach((def) => builder.define(def));
    res.rs.forEach((r) =>
      builder.resolveRS(r.reducerRule, r.anotherRule, r.options),
    );

    return builder.build(lexer, options);
  }
}
