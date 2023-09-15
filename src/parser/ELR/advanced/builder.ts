import type { ILexer } from "../../../lexer";
import type { Logger } from "../../../logger";
import type {
  Definition,
  ParserBuilderData,
  RS_ResolverOptions,
} from "../builder";
import { DefinitionContextBuilder, ParserBuilder } from "../builder";
import type { BuildOptions, IParserBuilder } from "../model";
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
      this.expand(defs, debug, logger, true, (res) => {
        res.defs.forEach((def) => {
          toBeLoaded.push({
            defs: def,
            ctxBuilder,
            resolveOnly,
            hydrationId,
          });
        });
        // generated rs resolver
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
