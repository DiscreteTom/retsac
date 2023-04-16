import { GrammarRule, Grammar, Condition } from "../model";
import { LR_BuilderError } from "./error";
import { DefinitionContextBuilder } from "./ctx-builder";
import {
  ResolvedConflict,
  ResolvedTempConflict,
  RR_ResolverOptions,
  RS_ResolverOptions,
  TempGrammarRule,
  TempGrammarType,
} from "./model";
import { Conflict, ConflictType, Definition } from "./model";
import { defToTempGRs } from "./utils/definition";
import { DFA, DFABuilder } from "../DFA";
import { ILexer } from "../../../lexer";
import { getConflicts, getUnresolvedConflicts } from "./utils/conflict";
import { Parser } from "../parser";
import {
  BuilderDecorator,
  BuildOptions,
  IParserBuilder,
} from "../model/builder";

/**
 * Builder for ELR parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * When build, it's recommended to set `checkAll` to `true` when developing.
 */
export class ParserBuilder<T> implements IParserBuilder<T> {
  protected data: {
    defs: Definition;
    ctxBuilder?: DefinitionContextBuilder<T>;
  }[] = [];
  private entryNTs: Set<string>;
  private resolvedTemp: ResolvedTempConflict<T>[];
  private cascadeQueryPrefix?: string;

  constructor(options?: { cascadeQueryPrefix?: string }) {
    this.entryNTs = new Set();
    this.resolvedTemp = [];
    this.cascadeQueryPrefix = options?.cascadeQueryPrefix;
  }

  entry(...defs: string[]) {
    this.entryNTs = new Set(defs);
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
  define(defs: Definition, ctxBuilder?: DefinitionContextBuilder<T>) {
    this.data.push({ defs, ctxBuilder });
    return this;
  }

  // TODO: move to DFA builder
  private processDefinitions(): {
    tempGrammarRules: readonly TempGrammarRule<T>[];
    NTs: ReadonlySet<string>;
  } {
    const tempGrammarRules: TempGrammarRule<T>[] = [];
    const NTs: Set<string> = new Set();

    this.data.forEach((d) => {
      const ctxBuilder = d.ctxBuilder;
      const defs = d.defs;
      const ctx = ctxBuilder?.build();
      const grs = defToTempGRs(defs, ctx);

      tempGrammarRules.push(...grs);
      grs.forEach((gr) => {
        NTs.add(gr.NT);
      });

      // handle resolved conflicts
      ctx?.resolved?.forEach((r) => {
        if (r.type == ConflictType.REDUCE_REDUCE) {
          defToTempGRs<T>(r.anotherRule).forEach((a) => {
            grs.forEach((gr) => {
              this.resolvedTemp.push({
                type: ConflictType.REDUCE_REDUCE,
                reducerRule: gr,
                anotherRule: a,
                options: r.options,
              });
            });
          });
        } else {
          defToTempGRs<T>(r.anotherRule).forEach((a) => {
            grs.forEach((gr) => {
              this.resolvedTemp.push({
                type: ConflictType.REDUCE_SHIFT,
                reducerRule: gr,
                anotherRule: a,
                options: r.options,
              });
            });
          });
        }
      });
    });

    return { tempGrammarRules, NTs };
  }

  /**
   * Ensure all T/NTs have their definitions, and no duplication, and all literals are valid.
   * If ok, return this.
   *
   */
  private checkSymbols(
    NTs: ReadonlySet<string>,
    Ts: ReadonlySet<string>,
    tempGrammarRules: readonly TempGrammarRule<T>[],
    lexer: ILexer
  ) {
    // TODO: use grammar rule instead of temp grammar rule
    /** T/NT names. */
    const grammarSet: Set<string> = new Set();

    // collect T/NT names in temp grammar rules
    tempGrammarRules.forEach((g) => {
      g.rule.forEach((grammar) => {
        if (grammar.type == TempGrammarType.GRAMMAR)
          grammarSet.add(grammar.content);
      });
    });

    // all symbols should have its definition
    grammarSet.forEach((g) => {
      if (!Ts.has(g) && !NTs.has(g)) throw LR_BuilderError.unknownGrammar(g);
    });

    // check duplication
    NTs.forEach((name) => {
      if (Ts.has(name)) throw LR_BuilderError.duplicatedDefinition(name);
    });

    // entry NTs must in NTs
    this.entryNTs.forEach((NT) => {
      if (!NTs.has(NT)) throw LR_BuilderError.unknownEntryNT(NT);
    });

    // all literals must can be tokenized by lexer
    lexer = lexer.dryClone();
    tempGrammarRules.forEach((gr) => {
      gr.rule.forEach((grammar) => {
        if (grammar.type == TempGrammarType.LITERAL) {
          if (lexer.reset().lex(grammar.content) == null)
            throw LR_BuilderError.invalidLiteral(grammar.content, gr);
        }
      });
    });

    return this;
  }

  private buildDFA(lexer: ILexer, debug: boolean | undefined) {
    if (this.entryNTs.size == 0) throw LR_BuilderError.noEntryNT();

    // TODO: move to DFA builder
    const { tempGrammarRules, NTs } = this.processDefinitions();

    // transform temp grammar rules to grammar rules
    const grs = tempGrammarRules.map(
      (gr) =>
        new GrammarRule<T>({
          NT: gr.NT,
          callback: gr.callback ?? (() => {}),
          rejecter: gr.rejecter ?? (() => false),
          rollback: gr.rollback ?? (() => {}),
          commit: gr.commit ?? (() => false),
          traverser: gr.traverser,
          rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
        })
    );

    // build the DFA
    const dfa = new DFA<T>(
      ...DFABuilder.build<T>(lexer, grs, this.entryNTs, NTs),
      this.cascadeQueryPrefix
    );

    // transform resolved temp conflicts to resolved conflicts
    const resolved: ResolvedConflict<T>[] = this.resolvedTemp.map((r) => {
      // find the grammar rules
      const reducerRule = grs.find((gr) => r.reducerRule.weakEq(gr));
      if (!reducerRule)
        throw LR_BuilderError.grammarRuleNotFound(r.reducerRule);
      const anotherRule = grs.find((gr) => r.anotherRule.weakEq(gr));
      if (!anotherRule)
        throw LR_BuilderError.grammarRuleNotFound(r.anotherRule);

      const next =
        r.options.next == "*"
          ? "*"
          : // TODO: use a dedicated lexer to parse next
            defToTempGRs<T>({ "": r.options.next ?? "" })[0]?.rule.map((g) =>
              g.toGrammar(NTs.has(g.content))
            ) ?? [];

      return {
        reducerRule,
        anotherRule,
        type: r.type,
        next,
        handleEnd:
          r.type == ConflictType.REDUCE_REDUCE
            ? r.options.handleEnd ?? false
            : false,
        reduce: r.options.reduce ?? true,
      };
    });

    const conflicts = getConflicts<T>(this.entryNTs, grs, dfa, debug);

    // apply resolved conflicts to grammar rule rejecters
    resolved.forEach((r) => {
      const { nextGrammars, needHandleEnd } = parseResolved(r, conflicts);
      // if no conflict, no need to update rejecter
      if (nextGrammars.length == 0 && !needHandleEnd) return;
      // pre-calculate next nodes to avoid repeated calculation
      const nextNodes = nextGrammars.map((g) => g.toTempASTNode(lexer));

      const generated: Condition<T> = (ctx) => {
        if (
          r.type == ConflictType.REDUCE_REDUCE &&
          // we have to make sure the end is needed to be checked
          needHandleEnd
        ) {
          // if reach end of input
          if (ctx.after.length == 0) {
            // if handle the end of input
            if (r.handleEnd)
              return !(r.reduce instanceof Function ? r.reduce(ctx) : r.reduce);
            else return false;
          }
        }
        // else, not the end of input
        // check if any next grammar match the next token
        if (
          nextNodes.some(
            (g) =>
              ctx.lexer
                .clone() // clone the lexer with state to peek next and avoid changing the original lexer
                .lex({
                  // peek with expectation
                  expect: {
                    type: g.type,
                    text: g.text,
                  },
                }) != null
          )
        )
          // next match, apply the `reduce`
          return !(r.reduce instanceof Function ? r.reduce(ctx) : r.reduce);
        return false;
      };

      const rejecter = r.reducerRule.rejecter; // get the original rejecter
      r.reducerRule.rejecter = (ctx) => {
        return rejecter(ctx) || generated(ctx);
      };
    });

    return {
      dfa,
      resolved,
      NTs,
      tempGrammarRules,
      conflicts,
    };
  }

  build(lexer: ILexer, options?: BuildOptions) {
    const { dfa, resolved, NTs, tempGrammarRules, conflicts } = this.buildDFA(
      lexer,
      options?.debug
    );
    dfa.debug = options?.debug ?? false;

    // check symbols first
    if (options?.checkAll || options?.checkSymbols)
      this.checkSymbols(NTs, lexer.getTokenTypes(), tempGrammarRules, lexer);

    // deal with conflicts
    if (
      options?.checkAll ||
      options?.checkConflicts ||
      options?.generateResolvers
    ) {
      const unresolved = getUnresolvedConflicts<T>(
        conflicts,
        resolved,
        options?.debug
      );

      if (options?.generateResolvers)
        this.generateResolvers(unresolved, options?.generateResolvers);

      if (options?.checkAll || options?.checkConflicts)
        this.checkConflicts(
          dfa,
          unresolved,
          conflicts,
          resolved,
          options?.printAll || false
        );
    }

    return new Parser(dfa, lexer);
  }

  /**
   * Ensure all reduce-shift and reduce-reduce conflicts are resolved.
   * If ok, return this.
   *
   * If `printAll` is true, print all conflicts instead of throwing error.
   */
  private checkConflicts(
    dfa: DFA<T>,
    unresolved: ReadonlyMap<GrammarRule<T>, Conflict<T>[]>,
    conflicts: ReadonlyMap<GrammarRule<T>, Conflict<T>[]>,
    resolved: ResolvedConflict<T>[],
    printAll: boolean
  ) {
    const followSets = dfa.getFollowSets();

    // ensure all conflicts are resolved
    unresolved.forEach((cs) => {
      cs.forEach((c) => {
        const err = LR_BuilderError.conflict(c);
        if (printAll) console.log(err.message);
        else throw err;
      });
    });

    // ensure all grammar rules resolved are appeared in the grammar rules
    // this is done in `buildDFA`

    // ensure all next grammars in resolved rules indeed in the follow set of the reducer rule's NT
    resolved.forEach((g) => {
      if (g.next == "*") return;
      g.next.forEach((n) => {
        if (!followSets.get(g.reducerRule.NT)!.has(n)) {
          const err = LR_BuilderError.nextGrammarNotFound(n, g.reducerRule.NT);
          if (printAll) console.log(err.message);
          else throw err;
        }
      });
    });

    // ensure all resolved are indeed conflicts
    // first, transform the conflicts to a single array
    const allConflicts = [] as Conflict<T>[];
    conflicts.forEach((cs) => allConflicts.push(...cs));
    // then, ensure all resolved are in the conflicts
    resolved.forEach((c) => {
      // check next
      if (c.next != "*")
        c.next.forEach((n) => {
          if (
            !allConflicts.some(
              (conflict) =>
                c.reducerRule == conflict.reducerRule &&
                c.anotherRule == conflict.anotherRule &&
                c.type == conflict.type &&
                (conflict.next as Grammar[]).some((nn) => n.eq(nn))
            )
          ) {
            const err = LR_BuilderError.noSuchConflict(
              c.reducerRule,
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
        !allConflicts.some(
          (conflict) =>
            c.reducerRule == conflict.reducerRule &&
            c.anotherRule == conflict.anotherRule &&
            c.type == conflict.type &&
            conflict.handleEnd
        )
      ) {
        const err = LR_BuilderError.noSuchConflict(
          c.reducerRule,
          c.anotherRule,
          c.type,
          [],
          true
        );
        if (printAll) console.log(err.message);
        else throw err;
      }
    });
    return this;
  }

  private generateResolvers(
    unresolved: Map<GrammarRule<T>, Conflict<T>[]>,
    style: "builder" | "context"
  ) {
    if (style == "builder") {
      unresolved.forEach((v, k) => {
        const txt = v
          .map(
            (c) =>
              `.resolve${
                c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
              }(${c.reducerRule.toString()}, ${c.anotherRule.toString()}, { ${
                c.next.length > 0
                  ? `next: \`${(c.next as Grammar[])
                      .map((g) => g.toString())
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
          `=== ${k.toString()} ===\nLR` +
          v
            .map(
              (c) =>
                `.resolve${
                  c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
                }(${c.anotherRule.toString()}, { ${
                  c.next.length > 0
                    ? `next: \`${(c.next as Grammar[])
                        .map((g) => g.toString())
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
    reducerRule: Definition,
    anotherRule: Definition,
    options: RS_ResolverOptions<T>
  ) {
    const reducerRules = defToTempGRs<T>(reducerRule);
    const anotherRules = defToTempGRs<T>(anotherRule);
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
    reducerRule: Definition,
    anotherRule: Definition,
    options: RR_ResolverOptions<T>
  ) {
    const reducerRules = defToTempGRs<T>(reducerRule);
    const anotherRules = defToTempGRs<T>(anotherRule);
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

  use(f: BuilderDecorator<T>): this {
    return f(this) as this;
  }

  priority(...defs: (Definition | Definition[])[]) {
    // grammar rules with higher priority will always be reduced first
    // e.g. priority([{ exp: `exp '*' exp` }], [{ exp: `exp '+' exp` }])
    defs.forEach((def, i) => {
      // def: [{ exp: `exp '*' exp` }]
      (def instanceof Array ? def : [def]).forEach((d) => {
        // d: { exp: `exp '*' exp` }
        defs.forEach((def2, j) => {
          if (j <= i) return;
          // def2: [{ exp: `exp '+' exp` }]
          (def2 instanceof Array ? def2 : [def2]).forEach((d2) => {
            // d2: { exp: `exp '+' exp` }
            this.resolveRS(d, d2, { next: `*`, reduce: true });
            this.resolveRR(d, d2, { next: `*`, reduce: true, handleEnd: true });
            this.resolveRS(d2, d, { next: `*`, reduce: false });
            this.resolveRR(d2, d, {
              next: `*`,
              reduce: false,
              handleEnd: true,
            });
          });
        });
      });
    });

    // grammar rules with the same priority will be reduced from left to right
    // e.g. priority([{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }])
    defs.forEach((def) => {
      if (def instanceof Array) {
        def.forEach((d, i) => {
          def.forEach((d2, j) => {
            if (i == j) return;
            this.resolveRS(d, d2, { next: `*`, reduce: true });
            this.resolveRR(d, d2, { next: `*`, reduce: true, handleEnd: true });
            this.resolveRS(d2, d, { next: `*`, reduce: true });
            this.resolveRR(d2, d, { next: `*`, reduce: true, handleEnd: true });
          });
        });
      }
    });

    return this;
  }

  leftSA(...defs: Definition[]) {
    defs.forEach((def) => {
      this.resolveRS(def, def, { next: `*`, reduce: true });
    });
    return this;
  }

  rightSA(...defs: Definition[]) {
    defs.forEach((def) => {
      this.resolveRS(def, def, { next: `*`, reduce: false });
    });
    return this;
  }
}

function parseResolved<T>(
  r: Readonly<ResolvedConflict<T>>,
  conflicts: ReadonlyMap<GrammarRule<T>, Conflict<T>[]>
) {
  const result = {
    nextGrammars: [] as Grammar[],
    needHandleEnd: false,
  };

  if (r.type == ConflictType.REDUCE_REDUCE) {
    if (r.next != "*") {
      // just apply the next
      result.nextGrammars = r.next;
    } else {
      // r.next == '*', so we need to calculate the next
      result.nextGrammars = (conflicts.get(r.reducerRule) ?? [])
        .filter(
          (c) =>
            c.type == ConflictType.REDUCE_REDUCE &&
            c.anotherRule == r.anotherRule
        )
        .map((c) => c.next as Grammar[])
        .flat();
    }

    // check handleEnd
    result.needHandleEnd = (conflicts.get(r.reducerRule) ?? []).some((c) => {
      return (
        c.type == ConflictType.REDUCE_REDUCE &&
        c.anotherRule == r.anotherRule &&
        c.handleEnd
      );
    });
  } else {
    // this is a reduce-shift conflict
    if (r.next != "*") {
      // just apply the next
      result.nextGrammars = r.next;
    } else {
      // r.next == '*', so we need to calculate the next
      result.nextGrammars = (conflicts.get(r.reducerRule) ?? [])
        .filter(
          (c) =>
            c.type == ConflictType.REDUCE_SHIFT &&
            c.anotherRule == r.anotherRule
        )
        .map((c) => c.next as Grammar[])
        .flat();
    }
  }

  return result;
}
