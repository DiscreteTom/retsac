import { ILexer } from "../../../lexer";
import {
  Definition,
  ParserBuilder,
  RR_ResolverOptions,
  RS_ResolverOptions,
} from "../builder";
import { BuildOptions, IParserBuilder } from "../model/builder";
import { GrammarExpander } from "./utils/advanced-grammar-parser";

export class AdvancedBuilder<T>
  extends ParserBuilder<T>
  implements IParserBuilder<T>
{
  private readonly expander: GrammarExpander;
  // resolved conflicts will be stored here first
  // before passing to the super class
  // because we may need to expand the definitions
  private readonly resolvedRS: {
    reducerRule: Definition;
    anotherRule: Definition;
    options: RS_ResolverOptions<T>;
  }[];
  private readonly resolvedRR: {
    reducerRule: Definition;
    anotherRule: Definition;
    options: RR_ResolverOptions<T>;
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
    d: Definition,
    debug: boolean | undefined,
    resolve: boolean,
    cb: (res: {
      defs: Definition[];
      rs: {
        reducerRule: Definition;
        anotherRule: Definition;
        options: RS_ResolverOptions<T>;
      }[];
    }) => void
  ) {
    for (const NT in d) {
      const def = d[NT];
      const defStr = def instanceof Array ? def.join("|") : def;
      const res = this.expander.expand<T>(defStr, NT, debug, resolve);
      cb(res);
    }
  }

  build(lexer: ILexer<any, any>, options?: BuildOptions) {
    // re-generate this.data
    const raw = [...this.data]; // deep copy since we will clear this.data
    this.data.length = 0; // clear
    raw.forEach(({ defs, ctxBuilder }) => {
      this.expand(defs, options?.debug, true, (res) => {
        res.defs.forEach((def) => this.data.push({ defs: def, ctxBuilder }));
        res.rs.forEach((r) =>
          // the reducerRule/anotherRule is already expanded, so we use super.resolveRS()
          super.resolveRS(r.reducerRule, r.anotherRule, r.options)
        );
      });
    });

    // expand definitions in resolvers
    this.resolvedRS.forEach((rc) => {
      const reducerRules: Definition[] = [];
      const anotherRules: Definition[] = [];
      this.expand(rc.reducerRule, false, false, (res) => {
        reducerRules.push(...res.defs);
      });
      this.expand(rc.anotherRule, false, false, (res) => {
        anotherRules.push(...res.defs);
      });
      reducerRules.forEach((r) => {
        anotherRules.forEach((a) => {
          super.resolveRS(r, a, rc.options);
        });
      });
    });
    this.resolvedRR.forEach((rc) => {
      const reducerRules: Definition[] = [];
      const anotherRules: Definition[] = [];
      this.expand(rc.reducerRule, false, false, (res) => {
        reducerRules.push(...res.defs);
      });
      this.expand(rc.anotherRule, false, false, (res) => {
        anotherRules.push(...res.defs);
      });
      reducerRules.forEach((r) => {
        anotherRules.forEach((a) => {
          super.resolveRR(r, a, rc.options);
        });
      });
    });

    // generate placeholder grammar rules
    const res = this.expander.generatePlaceholderGrammarRules<T>(
      options?.debug
    );
    res.defs.forEach((def) => this.data.push({ defs: def }));
    res.rs.forEach((r) =>
      super.resolveRS(r.reducerRule, r.anotherRule, r.options)
    );

    return super.build(lexer, options);
  }

  resolveRS(
    reducerRule: Definition,
    anotherRule: Definition,
    options: RS_ResolverOptions<T>
  ) {
    this.resolvedRS.push({ reducerRule, anotherRule, options });
    return this;
  }
  resolveRR(
    reducerRule: Definition,
    anotherRule: Definition,
    options: RR_ResolverOptions<T>
  ) {
    this.resolvedRR.push({ reducerRule, anotherRule, options });
    return this;
  }
}
