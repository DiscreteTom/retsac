import {
  GrammarRule,
  Grammar,
  BuilderDecorator,
  BuildOptions,
  IParserBuilder,
  Conflict,
  ConflictType,
  GrammarType,
  GrammarRepo,
  GrammarRuleRepo,
} from "../model";
import { LR_BuilderError } from "./error";
import { DefinitionContextBuilder } from "./ctx-builder";
import {
  ParserBuilderData,
  ResolvedTempConflict,
  RR_ResolverOptions,
  RS_ResolverOptions,
  Definition,
} from "./model";
import { defToTempGRs } from "./utils/definition";
import { Candidate, DFA, DFABuilder, State } from "../DFA";
import { ILexer } from "../../../lexer";
import { getConflicts, getUnresolvedConflicts } from "./utils/conflict";
import { Parser } from "../parser";
import { Logger } from "../../../model";

/**
 * Builder for ELR parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * When build, it's recommended to set `checkAll` to `true` when developing.
 */
export class ParserBuilder<ASTData, Kinds extends string = "">
  implements IParserBuilder<ASTData, Kinds>
{
  // use protected for AdvancedParserBuilder
  protected readonly data: ParserBuilderData<ASTData, Kinds> = [];
  private readonly entryNTs: Set<string>;
  /**
   * Resolved temporary conflicts.
   * This will be filled in 2 places:
   *
   * 1. When `builder.resolveRS` or `builder.resolveRR` is called, the resolved conflicts will be pushed to this array.
   * 2. When `builder.build` is called, the resolved conflicts in DefinitionContext will be transformed and pushed to this.
   */
  private readonly resolvedTemp: ResolvedTempConflict<ASTData, Kinds>[];
  /**
   * For most cases, this is used by AdvancedParserBuilder for cascading query.
   * You can also customize this.
   */
  private readonly cascadeQueryPrefix?: string;

  constructor(options?: {
    /**
     * For most cases, this is used by AdvancedParserBuilder for cascading query.
     * You can also customize this.
     */
    cascadeQueryPrefix?: string;
  }) {
    this.entryNTs = new Set();
    this.resolvedTemp = [];
    this.cascadeQueryPrefix = options?.cascadeQueryPrefix;
  }

  entry<Append extends string>(
    ...defs: Append[]
  ): IParserBuilder<ASTData, Kinds | Append> {
    this.entryNTs.clear();
    defs.forEach((d) => this.entryNTs.add(d));
    return this;
  }

  /**
   * Definition syntax:
   * - `A | B` means `A` or `B`
   * - `A B` means `A` then `B`
   * - `'xxx'` or `"xxx"` means literal string `xxx`
   *   - Escaped quote is supported. E.g.: `'abc\'def'`
   *
   * E.g.:
   *
   * ```js
   * define({ exp: `A B | 'xxx' B` })
   * // means `A B` or `'xxx' B`, and reduce to `exp`
   * // equals to:
   * define({ exp: [`A B`, `'xxx' B`] })
   * ```
   */
  define<Append extends string>(
    defs: Definition<Kinds | Append>,
    ctxBuilder?: DefinitionContextBuilder<ASTData, Kinds | Append>
  ): IParserBuilder<ASTData, Kinds | Append> {
    (this.data as ParserBuilderData<ASTData, Kinds | Append>).push({
      defs,
      ctxBuilder,
    });
    return this as IParserBuilder<ASTData, Kinds | Append>;
  }

  /**
   * Ensure all T/NTs have their definitions, and no duplication, and all literals are valid.
   * If ok, return this.
   */
  private checkSymbols(
    NTs: ReadonlySet<string>,
    Ts: ReadonlySet<string>,
    grs: GrammarRuleRepo<ASTData, Kinds>,
    lexer: Readonly<ILexer<any, any>>,
    printAll: boolean
  ) {
    // all grammar symbols should have its definition, either in NTs or Ts
    grs.grammarRules.forEach((gr) => {
      gr.rule.forEach((g) => {
        if (g.text == undefined) {
          // N/NT
          if (!Ts.has(g.kind) && !NTs.has(g.kind)) {
            const e = LR_BuilderError.unknownGrammar(g.kind);
            if (printAll) console.log(e.message);
            else throw e;
          }
        }
      });
    });

    // check duplication
    NTs.forEach((name) => {
      if (Ts.has(name)) {
        const e = LR_BuilderError.duplicatedDefinition(name);
        if (printAll) console.log(e.message);
        else throw e;
      }
    });

    // entry NTs must in NTs
    this.entryNTs.forEach((NT) => {
      if (!NTs.has(NT)) {
        const e = LR_BuilderError.unknownEntryNT(NT);
        if (printAll) console.log(e.message);
        else throw e;
      }
    });

    // all literals must be able to be tokenized by lexer
    // TODO: is this already checked when GrammarRepo create the grammar?
    lexer = lexer.dryClone();
    grs.grammarRules.forEach((gr) => {
      gr.rule.forEach((grammar) => {
        if (grammar.text != undefined) {
          if (lexer.reset().lex(grammar.text!) == null) {
            const e = LR_BuilderError.invalidLiteral(grammar.text!, gr);
            if (printAll) console.log(e.message);
            else throw e;
          }
        }
      });
    });

    return this;
  }

  private buildDFA<LexerKinds extends string>(
    lexer: ILexer<any, LexerKinds>,
    printAll: boolean,
    options?: {
      debug?: boolean;
      logger?: Logger;
      rollback?: boolean;
      reLex?: boolean;
    }
  ) {
    if (this.entryNTs.size == 0) {
      const e = LR_BuilderError.noEntryNT();
      if (printAll) console.log(e.message);
      else throw e;
    }

    const repo = new GrammarRepo();

    // build the DFA
    const {
      grs,
      entryNTs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      allInitialCandidates,
      allStates,
      NTs,
    } = DFABuilder.prepare<ASTData, Kinds>(
      repo,
      lexer,
      this.entryNTs,
      this.data,
      this.resolvedTemp
    );
    const dfa = new DFA<ASTData, Kinds | LexerKinds>(
      grs as any, // TODO: better typing
      entryNTs,
      entryState as State<ASTData, Kinds | LexerKinds>,
      NTClosures as Map<string, GrammarRule<ASTData, Kinds | LexerKinds>[]>,
      firstSets,
      followSets,
      allInitialCandidates as Map<
        string,
        Candidate<ASTData, Kinds | LexerKinds>
      >,
      allStates as Map<string, State<ASTData, Kinds | LexerKinds>>,
      repo,
      this.cascadeQueryPrefix,
      options?.rollback ?? false,
      options?.reLex ?? true,
      options?.debug ?? false,
      options?.logger ?? console.log
    );

    // transform resolved temp conflicts to resolved conflicts
    // and append into grammar rules
    this.resolvedTemp.forEach((r) => {
      // find the grammar rules
      const reducerRule = grs.get(r.reducerRule);
      if (!reducerRule) {
        const e = LR_BuilderError.grammarRuleNotFound(r.reducerRule);
        if (printAll) {
          console.log(e);
          return;
        } else throw e;
      }
      const anotherRule = grs.get(r.anotherRule);
      if (!anotherRule) {
        const e = LR_BuilderError.grammarRuleNotFound(r.anotherRule);
        if (printAll) {
          console.log(e);
          return;
        } else throw e;
      }

      const next =
        r.options.next == "*"
          ? "*"
          : // TODO: use a dedicated lexer to parse next
            defToTempGRs<ASTData, Kinds>({
              "": r.options.next ?? "",
            } as Definition<Kinds>)[0]?.rule.map((g) =>
              g.toGrammar(repo, lexer, NTs.has(g.content))
            ) ?? [];

      reducerRule.resolved.push({
        anotherRule,
        type: r.type,
        next,
        handleEnd:
          r.type == ConflictType.REDUCE_REDUCE
            ? r.options.handleEnd ?? false
            : false,
        accepter: r.options.accept ?? true,
      });
    });

    return {
      grs,
      dfa,
      NTs,
      repo,
    };
  }

  build<LexerKinds extends string>(
    lexer: ILexer<any, LexerKinds>,
    options?: BuildOptions
  ) {
    const { dfa, NTs, grs, repo } = this.buildDFA(
      lexer,
      options?.printAll ?? false,
      options
    );
    dfa.debug = options?.debug ?? false;

    // check symbols first
    if (options?.checkAll || options?.checkSymbols)
      this.checkSymbols(
        NTs,
        lexer.getTokenKinds(),
        grs,
        lexer,
        options.printAll ?? false
      );

    // deal with conflicts
    if (
      options?.checkAll ||
      options?.checkConflicts ||
      options?.generateResolvers
    ) {
      // conflicts are stored in grs
      getConflicts<ASTData, Kinds>(
        repo,
        this.entryNTs,
        grs,
        dfa as any, // TODO
        options?.debug
      );

      // resolved conflicts are already stored in grs in this.buildDFA
      const unresolved = getUnresolvedConflicts<ASTData, Kinds>(
        grs,
        options?.debug ?? false
      );

      if (options?.generateResolvers !== undefined)
        this.generateResolvers(unresolved, options.generateResolvers);

      if (options?.checkAll || options?.checkConflicts)
        this.checkConflicts(
          dfa as any, // TODO
          unresolved,
          grs,
          options?.printAll || false
        );
    }

    return new Parser<ASTData, Kinds | LexerKinds>(dfa, lexer);
  }

  /**
   * Ensure all reduce-shift and reduce-reduce conflicts are resolved.
   * If ok, return this.
   *
   * If `printAll` is true, print all conflicts instead of throwing error.
   */
  private checkConflicts(
    dfa: DFA<ASTData, Kinds>,
    unresolved: ReadonlyMap<
      GrammarRule<ASTData, Kinds>,
      Conflict<ASTData, Kinds>[]
    >,
    grs: GrammarRuleRepo<ASTData, Kinds>,
    printAll: boolean
  ) {
    const followSets = dfa.followSets;

    // ensure all conflicts are resolved
    unresolved.forEach((cs, gr) => {
      cs.forEach((c) => {
        const err = LR_BuilderError.conflict(gr, c);
        if (printAll) console.log(err.message);
        else throw err;
      });
    });

    // ensure all grammar rules resolved are appeared in the grammar rules
    // this is done in `buildDFA`

    // ensure all next grammars in resolved rules indeed in the follow set of the reducer rule's NT
    grs.grammarRules.forEach((reducerRule) => {
      reducerRule.resolved.forEach((g) => {
        if (g.next == "*") return;
        g.next.forEach((n) => {
          if (!followSets.get(reducerRule.NT)!.has(n)) {
            const err = LR_BuilderError.nextGrammarNotFound(n, reducerRule.NT);
            if (printAll) console.log(err.message);
            else throw err;
          }
        });
      });
    });

    // ensure all resolved are indeed conflicts
    grs.grammarRules.forEach((reducerRule) => {
      reducerRule.resolved.forEach((c) => {
        // check next
        if (c.next != "*")
          c.next.forEach((n) => {
            if (
              !reducerRule.conflicts.some(
                (conflict) =>
                  c.anotherRule == conflict.anotherRule &&
                  c.type == conflict.type &&
                  conflict.next.some((nn) => n.equalWithoutName(nn)) // TODO: just use `==`?
              )
            ) {
              const err = LR_BuilderError.noSuchConflict(
                reducerRule,
                c.anotherRule,
                c.type,
                [n],
                false
              );
              if (printAll) console.log(err.message);
              else throw err;
            }
          });
        // check handleEnd
        if (
          c.next != "*" &&
          c.handleEnd &&
          reducerRule.conflicts.some(
            (conflict) =>
              c.anotherRule == conflict.anotherRule &&
              c.type == conflict.type &&
              conflict.handleEnd
          )
        ) {
          const err = LR_BuilderError.noSuchConflict(
            reducerRule,
            c.anotherRule,
            c.type,
            [],
            true
          );
          if (printAll) console.log(err.message);
          else throw err;
        }
      });
    });
    return this;
  }

  private generateResolvers(
    unresolved: Map<GrammarRule<ASTData, Kinds>, Conflict<ASTData, Kinds>[]>,
    style: "builder" | "context"
  ) {
    if (style == "builder") {
      unresolved.forEach((v, reducerRule) => {
        const txt = v
          .map(
            (c) =>
              `.resolve${c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"}(${
                reducerRule.strWithGrammarName.value
              }, ${c.anotherRule.strWithGrammarName.value}, { ${
                c.next.length > 0
                  ? `next: \`${(c.next as Grammar[])
                      .map((g) => g.grammarStrWithName)
                      .join(" ")}\`, `
                  : ""
              }${c.handleEnd ? `handleEnd: true, ` : ""}reduce: true })`
          )
          .join("\n");
        console.log(txt);
      });
    } else {
      unresolved.forEach((v, k) => {
        const txt =
          `=== ${k} ===\nLR` +
          v
            .map(
              (c) =>
                `.resolve${c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"}(${
                  c.anotherRule.strWithGrammarName.value
                }, { ${
                  c.next.length > 0
                    ? `next: \`${(c.next as Grammar[])
                        .map((g) => g.grammarStrWithName)
                        .join(" ")}\`, `
                    : ""
                }${c.handleEnd ? `handleEnd: true, ` : ""}reduce: true })`
            )
            .join("\n  ");
        console.log(txt);
        console.log(""); // add a blank line
      });
    }

    return this;
  }

  resolveRS(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, Kinds>
  ) {
    const reducerRules = defToTempGRs<ASTData, Kinds>(reducerRule);
    const anotherRules = defToTempGRs<ASTData, Kinds>(anotherRule);
    reducerRules.forEach((r) => {
      anotherRules.forEach((a) => {
        this.resolvedTemp.push({
          type: ConflictType.REDUCE_SHIFT,
          reducerRule: r,
          anotherRule: a,
          options,
        });
      });
    });
    return this;
  }

  resolveRR(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, Kinds>
  ) {
    const reducerRules = defToTempGRs<ASTData, Kinds>(reducerRule);
    const anotherRules = defToTempGRs<ASTData, Kinds>(anotherRule);
    reducerRules.forEach((r) => {
      anotherRules.forEach((a) => {
        this.resolvedTemp.push({
          type: ConflictType.REDUCE_REDUCE,
          reducerRule: r,
          anotherRule: a,
          options,
        });
      });
    });
    return this;
  }

  use<Append extends string>(
    f: BuilderDecorator<ASTData, Kinds, Append>
  ): IParserBuilder<ASTData, Kinds | Append> {
    return f(this);
  }

  priority(...groups: (Definition<Kinds> | Definition<Kinds>[])[]) {
    // grammar rules with higher priority will always be reduced first
    // e.g. priority([{ exp: `exp '*' exp` }], [{ exp: `exp '+' exp` }])
    groups.forEach((higherDefs, higherIndex) => {
      groups.forEach((lowerDefs, lowerIndex) => {
        // lowerIndex should be greater than higherIndex
        // since higher priority defs should be defined before lower priority defs
        if (lowerIndex <= higherIndex) return;

        // higherDefs: [{ exp: `exp '*' exp` }]
        (higherDefs instanceof Array ? higherDefs : [higherDefs]).forEach(
          // higher: { exp: `exp '*' exp` }
          (higher) => {
            // lowerDefs: [{ exp: `exp '+' exp` }]
            (lowerDefs instanceof Array ? lowerDefs : [lowerDefs]).forEach(
              // lower: { exp: `exp '+' exp` }
              (lower) => {
                this.resolveRS(higher, lower, { next: `*`, accept: true });
                this.resolveRR(higher, lower, {
                  next: `*`,
                  accept: true,
                  handleEnd: true,
                });
                this.resolveRS(lower, higher, { next: `*`, accept: false });
                this.resolveRR(lower, higher, {
                  next: `*`,
                  accept: false,
                  handleEnd: true,
                });
              }
            );
          }
        );
      });
    });

    // grammar rules with the same priority will be reduced from left to right
    // e.g. priority([{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }])
    groups.forEach((defs) => {
      if (defs instanceof Array) {
        defs.forEach((d1, i) => {
          defs.forEach((d2, j) => {
            if (i == j) return; // skip itself
            this.resolveRS(d1, d2, { next: `*`, accept: true });
            this.resolveRR(d1, d2, {
              next: `*`,
              accept: true,
              handleEnd: true,
            });
            this.resolveRS(d2, d1, { next: `*`, accept: true });
            this.resolveRR(d2, d1, {
              next: `*`,
              accept: true,
              handleEnd: true,
            });
          });
        });
      }
    });

    return this;
  }

  leftSA(...defs: Definition<Kinds>[]) {
    defs.forEach((def) => {
      this.resolveRS(def, def, { next: `*`, accept: true });
    });
    return this;
  }

  rightSA(...defs: Definition<Kinds>[]) {
    defs.forEach((def) => {
      this.resolveRS(def, def, { next: `*`, accept: false });
    });
    return this;
  }
}
