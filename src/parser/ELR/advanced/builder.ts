import type { GeneralTokenDataBinding } from "../../../lexer";
import { defaultLogger, type Logger } from "../../../logger";
import type {
  Definition,
  ParserBuilderData,
  RS_ResolverOptions,
} from "../builder";
import { DefinitionContextBuilder, ParserBuilder } from "../builder";
import { buildSerializable } from "../builder/utils/serialize";
import type { BuildOptions, IParserBuilder } from "../model";
import { ConflictType } from "../model";
import { InvalidPlaceholderFollowError } from "./error";
import { GrammarExpander } from "./utils/grammar-expander";

export class AdvancedBuilder<
    Kinds extends string = never,
    ASTData = never,
    ErrorType = never,
    LexerDataBindings extends GeneralTokenDataBinding = never,
    LexerActionState = never,
    LexerError = never,
  >
  extends ParserBuilder<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >
  implements
    IParserBuilder<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >
{
  private readonly expander: GrammarExpander<
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;

  constructor(options?: {
    /**
     * Prefix of the generated placeholder grammar rules.
     * This will also be used as the cascade query prefix.
     */
    prefix?: string;
  }) {
    const prefix = options?.prefix ?? `__`;
    super({ cascadeQueryPrefix: prefix });
    this.expander = new GrammarExpander<
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >({
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
        options: RS_ResolverOptions<
          Kinds,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerError
        >;
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

  build(options: BuildOptions<Kinds, LexerDataBindings>) {
    // if hydrate, just call super.build()
    // since all data needed for build is in super.data & serialized data
    if (options.hydrate !== undefined) return super.build(options);

    const debug = options.debug ?? false;
    const logger = options.logger ?? defaultLogger;

    // generate a new parser builder to prevent side effects
    const builder = new ParserBuilder<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >({
      cascadeQueryPrefix: this.cascadeQueryPrefix,
    });

    // expand definitions in data
    const toBeLoaded = [] as ParserBuilderData<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >[];
    this.builderData.forEach(
      ({ defs, ctxBuilder, resolveOnly, hydrationId }) => {
        // first, expand another rules in ctx.resolvers if exists
        const ctx = ctxBuilder?.build();
        const expandedCtxBuilder = new DefinitionContextBuilder<
          Kinds,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerError
        >();
        ctx?.resolved.forEach((r) => {
          // for another rule, we don't need to log debug info or auto resolve R-S conflict
          this.expand(r.anotherRule, false, logger, false).forEach((res) => {
            res.defs.forEach((d) => {
              if (r.type === ConflictType.REDUCE_SHIFT) {
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
        this.expand(
          defs,
          resolveOnly ? false : debug,
          logger,
          // don't auto resolve R-S conflict if this data is resolve only
          !resolveOnly,
        ).forEach((res) => {
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
              ctxBuilder: new DefinitionContextBuilder<
                Kinds,
                ASTData,
                ErrorType,
                LexerDataBindings,
                LexerActionState,
                LexerError
              >().resolveRS(r.anotherRule, r.options),
              resolveOnly: true,
              hydrationId, // the hydration id does not matter, since the generated resolvers are serializable
            });
          });
        });
      },
    );
    builder.load(toBeLoaded);

    // generate placeholder grammar rules
    // hydration id does not matter here
    // since generated resolvers are serializable
    // and generated grammar rules don't have its own context
    const ph = this.expander.generatePlaceholderGrammarRules<
      ASTData,
      ErrorType
    >(debug, logger);
    ph.defs.forEach((def) => builder.define(def));
    ph.rs.forEach((r) =>
      builder.resolveRS(r.reducerRule, r.anotherRule, r.options),
    );

    // build but don't serialize
    const res = builder.build({ ...options, serialize: false });

    // if serialize, serialize with this.data instead of builder.data
    // because when hydrate, we directly use this to hydrate, instead of the new created builder
    if (options.serialize) {
      res.serializable = buildSerializable(
        this.builderData,
        res.parser.dfa,
        new Set(
          options.entry instanceof Array ? options.entry : [options.entry],
        ),
        this._lexer,
        this.cascadeQueryPrefix,
      );
    }

    // additional checks for #22
    if (options.checkAll || options.checkConflicts) {
      this.expander.placeholderMap.g2p.forEach((p, g) => {
        // for each placeholder NT
        // ensure there is no overlap between its follow set and first set
        // because the presumption of the generated resolver is that the overlap is empty
        // otherwise the LR(1) peek will fail
        const overlap = res.parser.dfa.followSets
          .get(p as Kinds)!
          .overlap(res.parser.dfa.firstSets.get(p as Kinds)!);

        if (overlap.grammars.size > 0) {
          const e = new InvalidPlaceholderFollowError(p, g, overlap);
          if (options.printAll)
            logger.log({ entity: "AdvancedBuilder", message: e.message });
          else throw e;
        }
      });
    }

    return res;
  }
}
