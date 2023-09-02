import {
  GrammarRule,
  Grammar,
  Condition,
  BuilderDecorator,
  BuildOptions,
  IParserBuilder,
  Conflict,
  ConflictType,
} from "../model";
import { LR_BuilderError } from "./error";
import { DefinitionContextBuilder } from "./ctx-builder";
import {
  ParserBuilderData,
  ResolvedConflict,
  ResolvedTempConflict,
  RR_ResolverOptions,
  RS_ResolverOptions,
  TempGrammarRule,
  TempGrammarType,
  Definition,
} from "./model";
import { defToTempGRs } from "./utils/definition";
import { DFA, DFABuilder } from "../DFA";
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
export class ParserBuilder<T> implements IParserBuilder<T> {
  protected data: ParserBuilderData<T> = [];
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

  /**
   * Ensure all T/NTs have their definitions, and no duplication, and all literals are valid.
   * If ok, return this.
   *
   */
  private checkSymbols(
    NTs: ReadonlySet<string>,
    Ts: ReadonlySet<string>,
    tempGrammarRules: readonly TempGrammarRule<T>[],
    lexer: ILexer<any>
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

  private buildDFA(
    lexer: ILexer<any>,
    options?: {
      debug?: boolean;
      logger?: Logger;
      rollback?: boolean;
      reLex?: boolean;
    }
  ) {
    if (this.entryNTs.size == 0) throw LR_BuilderError.noEntryNT();

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
      tempGrammarRules,
    } = DFABuilder.build<T>(lexer, this.entryNTs, this.data, this.resolvedTemp);
    const dfa = new DFA<T>(
      grs,
      entryNTs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      allInitialCandidates,
      allStates,
      this.cascadeQueryPrefix,
      options?.rollback ?? false,
      options?.reLex ?? true,
      options?.debug ?? false,
      options?.logger ?? console.log
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
        reduce: r.options.accept ?? true,
      };
    });

    const conflicts = getConflicts<T>(this.entryNTs, grs, dfa, options?.debug);

    // apply resolved conflicts to grammar rule rejecters
    resolved.forEach((r) => {
      const { nextGrammars, needHandleEnd } = parseResolved(r, conflicts);
      // if no conflict, no need to update rejecter
      if (nextGrammars.length == 0 && !needHandleEnd) return;

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
          nextGrammars.some(
            (g) =>
              ctx.lexer.lex({
                // peek with expectation
                peek: true,
                expect: {
                  kind: g.kind,
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

  build(lexer: ILexer<any>, options?: BuildOptions) {
    const { dfa, resolved, NTs, tempGrammarRules, conflicts } = this.buildDFA(
      lexer,
      options
    );
    dfa.debug = options?.debug ?? false;

    // check symbols first
    if (options?.checkAll || options?.checkSymbols)
      this.checkSymbols(NTs, lexer.getTokenKinds(), tempGrammarRules, lexer);

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
    const allConflicts = [] as {
      conflict: Conflict<T>;
      reducerRule: GrammarRule<T>;
    }[];
    conflicts.forEach(
      (cs, reducerRule) =>
        allConflicts.push(...cs.map((c) => ({ conflict: c, reducerRule }))) // TODO: remove temp array
    );
    // then, ensure all resolved are in the conflicts
    resolved.forEach((c) => {
      // check next
      if (c.next != "*")
        c.next.forEach((n) => {
          if (
            !allConflicts.some(
              ({ conflict, reducerRule }) =>
                c.reducerRule == reducerRule &&
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
          ({ conflict, reducerRule }) =>
            c.reducerRule == reducerRule &&
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
      unresolved.forEach((v, reducerRule) => {
        const txt = v
          .map(
            (c) =>
              `.resolve${
                c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
              }(${reducerRule.toString()}, ${c.anotherRule.toString()}, { ${
                c.next.length > 0
                  ? `next: \`${(c.next as Grammar[])
                      .map((g) => g.toString()) // TODO: change this to toGrammarString?
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
                        .map((g) => g.toString()) // TODO: change this to toGrammarString?
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
            this.resolveRS(d, d2, { next: `*`, accept: true });
            this.resolveRR(d, d2, { next: `*`, accept: true, handleEnd: true });
            this.resolveRS(d2, d, { next: `*`, accept: false });
            this.resolveRR(d2, d, {
              next: `*`,
              accept: false,
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
            this.resolveRS(d, d2, { next: `*`, accept: true });
            this.resolveRR(d, d2, { next: `*`, accept: true, handleEnd: true });
            this.resolveRS(d2, d, { next: `*`, accept: true });
            this.resolveRR(d2, d, { next: `*`, accept: true, handleEnd: true });
          });
        });
      }
    });

    return this;
  }

  leftSA(...defs: Definition[]) {
    defs.forEach((def) => {
      this.resolveRS(def, def, { next: `*`, accept: true });
    });
    return this;
  }

  rightSA(...defs: Definition[]) {
    defs.forEach((def) => {
      this.resolveRS(def, def, { next: `*`, accept: false });
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
