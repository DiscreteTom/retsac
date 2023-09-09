import { ILexer } from "../../../lexer";
import { Logger } from "../../../model";
import {
  Definition,
  ParserBuilder,
  RR_ResolverOptions,
  RS_ResolverOptions,
} from "../builder";
import { BuildOptions, IParserBuilder } from "../model/builder";
import { GrammarExpander } from "./utils/advanced-grammar-parser";

export class AdvancedBuilder<ASTData, Kinds extends string = never>
  extends ParserBuilder<ASTData, Kinds>
  implements IParserBuilder<ASTData, Kinds>
{
  private readonly expander: GrammarExpander<Kinds>;
  // resolved conflicts will be stored here first
  // before passing to the super class
  // because we may need to expand the definitions
  private readonly resolvedRS: {
    reducerRule: Definition<Kinds>;
    anotherRule: Definition<Kinds>;
    options: RS_ResolverOptions<ASTData, Kinds>;
  }[];
  private readonly resolvedRR: {
    reducerRule: Definition<Kinds>;
    anotherRule: Definition<Kinds>;
    options: RR_ResolverOptions<ASTData, Kinds>;
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
    this.expander = new GrammarExpander({ placeholderPrefix: prefix });
    this.resolvedRS = [];
    this.resolvedRR = [];
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
        options: RS_ResolverOptions<ASTData, Kinds>;
      }[];
    }) => void
  ) {
    for (const NT in d) {
      const def = d[NT];
      const defStr = def instanceof Array ? def.join("|") : (def as string);
      const res = this.expander.expand<ASTData>(
        defStr,
        NT,
        debug,
        logger,
        resolve
      );
      cb(res);
    }
  }

  build(lexer: ILexer<any, any>, options?: BuildOptions) {
    const debug = options?.debug ?? false;
    const logger = options?.logger ?? console.log;

    // re-generate this.data
    const raw = [...this.data]; // deep copy since we will clear this.data
    this.data.length = 0; // clear
    raw.forEach(({ defs, ctxBuilder }) => {
      this.expand(defs, debug, logger, true, (res) => {
        res.defs.forEach((def) => this.data.push({ defs: def, ctxBuilder }));
        res.rs.forEach((r) =>
          // the reducerRule/anotherRule is already expanded, so we use super.resolveRS()
          super.resolveRS(r.reducerRule, r.anotherRule, r.options)
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
          super.resolveRS(r, a, rc.options);
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
          super.resolveRR(r, a, rc.options);
        });
      });
    });

    // generate placeholder grammar rules
    const res = this.expander.generatePlaceholderGrammarRules<ASTData>(
      debug,
      logger
    );
    res.defs.forEach((def) => this.data.push({ defs: def }));
    res.rs.forEach((r) =>
      super.resolveRS(r.reducerRule, r.anotherRule, r.options)
    );

    return super.build(lexer, options);
  }

  resolveRS(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, Kinds>
  ) {
    this.resolvedRS.push({ reducerRule, anotherRule, options });
    return this;
  }
  resolveRR(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, Kinds>
  ) {
    this.resolvedRR.push({ reducerRule, anotherRule, options });
    return this;
  }
}
