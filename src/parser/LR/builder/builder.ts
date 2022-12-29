import { DFA } from "../DFA";
import { ParserError, ParserErrorType } from "../error";
import { Grammar, GrammarRule, GrammarType } from "../model";
import { Parser } from "../parser";
import { TempGrammarRule, TempGrammar, TempGrammarType } from "./grammar";
import {
  ResolvedConflict,
  Definition,
  DefinitionContextBuilder,
  ConflictType,
} from "./model";
import { defToTempGRs } from "./utils";

/**
 * Builder for LR(1) parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * It's recommended to use `checkAll` before `build` when debug.
 */
export class ParserBuilder<T> {
  private tempGrammarRules: TempGrammarRule<T>[];
  private entryNTs: Set<string>;
  private NTs: Set<string>;
  private resolved: ResolvedConflict<T>[];

  constructor() {
    this.tempGrammarRules = [];
    this.entryNTs = new Set();
    this.NTs = new Set();
    this.resolved = [];
  }

  /** Declare top-level NT's. */
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
    const ctx = ctxBuilder?.build();
    const grs = defToTempGRs(defs, ctx);

    this.tempGrammarRules.push(...grs);
    grs.forEach((gr) => {
      this.NTs.add(gr.NT);
      if (ctx)
        this.resolved.push(
          ...ctx.resolved.map((r) => ({
            ...r,
            reducer: gr,
          }))
        );
    });

    return this;
  }

  /** Merge grammar rules, NTs and resolved conflicts of another parser builder. */
  use(another: ParserBuilder<T>) {
    this.tempGrammarRules.push(...another.tempGrammarRules);
    this.NTs = new Set([...this.NTs, ...another.NTs]);
    this.resolved.push(...another.resolved);
    return this;
  }

  /** Return conflicts that user didn't resolve. */
  private unresolvedConflicts<_, __>(
    type: ConflictType,
    reducer: TempGrammarRule<_>,
    another: TempGrammarRule<__>,
    next: Grammar[],
    end: boolean
  ) {
    const related = this.resolved.filter(
      (r) =>
        r.type == type && reducer.weakEq(r.reducer) && another.weakEq(r.another)
    );

    // check next
    const resolvedNext = [] as TempGrammar[];
    related.forEach((r) => r.next.forEach((n) => resolvedNext.push(n)));
    const unresolvedNext = next.filter(
      (n) => !resolvedNext.some((rn) => n.eq(rn))
    );

    // check end
    const unresolvedEnd = end ? !related.some((r) => r.end) : false;

    return { next: unresolvedNext, end: unresolvedEnd };
  }

  /**
   * Turn temp grammar rules to grammar rules according to the known NTs.
   * This should be called only if no more definitions will be defined.
   */
  private getGrammarRules() {
    return this.tempGrammarRules.map(
      (gr) =>
        new GrammarRule<T>({
          NT: gr.NT,
          callback: gr.callback,
          rejecter: gr.rejecter,
          rule: gr.rule.map(
            (g) =>
              new Grammar({
                content: g.content,
                type:
                  g.type == TempGrammarType.LITERAL
                    ? GrammarType.LITERAL
                    : this.NTs.has(g.content)
                    ? GrammarType.NT
                    : GrammarType.T,
              })
          ),
        })
    );
  }

  private buildDFA() {
    if (this.entryNTs.size == 0)
      throw new ParserError(
        ParserErrorType.NO_ENTRY_NT,
        `Please set entry NTs for LR Parser.`
      );

    return new DFA<T>(this.getGrammarRules(), this.entryNTs, this.NTs);
  }

  /** Generate the LR(1) parser. */
  build(debug = false) {
    const dfa = this.buildDFA();
    dfa.debug = debug;

    return new Parser<T>(dfa);
  }

  /**
   * Ensure all T/NTs have their definitions, and no duplication.
   * If ok, return this.
   */
  checkSymbols(Ts: Set<string>) {
    /** T/NT names. */
    const grammarSet: Set<string> = new Set();

    // collect T/NT names in grammar rules
    this.tempGrammarRules.map((g) => {
      g.rule.map((grammar) => {
        if (grammar.type == TempGrammarType.GRAMMAR)
          grammarSet.add(grammar.content);
      });
    });

    // all symbols should have its definition
    grammarSet.forEach((g) => {
      if (!Ts.has(g) && !this.NTs.has(g))
        throw new ParserError(
          ParserErrorType.UNDEFINED_GRAMMAR_SYMBOL,
          `Undefined grammar symbol: ${g}`
        );
    });

    // check duplication
    this.NTs.forEach((name) => {
      if (Ts.has(name))
        throw new ParserError(
          ParserErrorType.DUPLICATED_DEFINITION,
          `Duplicated definition for grammar symbol: ${name}`
        );
    });

    // entry NTs must in NTs
    this.entryNTs.forEach((NT) => {
      if (!this.NTs.has(NT))
        throw new ParserError(
          ParserErrorType.UNDEFINED_ENTRY_NT,
          `Undefined entry NT: "${NT}"`
        );
    });

    return this;
  }

  /**
   * Ensure all reduce-shift and reduce-reduce conflicts are resolved.
   * If ok, return this.
   */
  checkConflicts(debug = false) {
    const dfa = this.buildDFA();
    const first = dfa.getFirst();
    const follow = dfa.getFollow();

    // if the tail of a grammar rule is the same as the head of another grammar rule, it's a reduce-shift conflict
    // e.g. `exp '+' exp | exp '*' exp` is a reduce-shift conflict, `A B C | B C D` is a reduce-shift conflict
    for (let i = 0; i < this.tempGrammarRules.length; i++) {
      for (let j = 0; j < this.tempGrammarRules.length; j++) {
        if (i == j) continue;
        const reducerRule = this.tempGrammarRules[i];
        const anotherRule = this.tempGrammarRules[j];
        const conflicts = reducerRule.checkRSConflict(anotherRule);
        conflicts.map((c) => {
          // try to auto resolve conflicts if possible
          // e.g. for a reduce-shift conflict: `A <= B C` and `D <= C E`
          // if A's follow overlap with E's first, then the conflict can't be auto resolved by LR1 peeking
          const A = c.reducerRule.NT;
          const E = c.shifterRule.rule[c.length];
          const EFirst = first.get(E.content);
          const AFollow = follow.get(A);
          if (E.type == TempGrammarType.GRAMMAR) {
            if (this.NTs.has(E.content)) {
              // E is a NT, check if A's follow has some grammar that is also in E's first
              const overlap = AFollow.overlap(EFirst);
              if (overlap.length < 0) return; // no overlap, all conflicts can be auto resolved

              // auto resolve failed, check if the conflicts are resolved by user
              const res = this.unresolvedConflicts(
                ConflictType.REDUCE_SHIFT,
                reducerRule,
                anotherRule,
                overlap,
                false // for a RS conflict, we don't need to handle end of input
              );

              if (res.next.length > 0) {
                const msg = `Unresolved R-S conflict (length: ${
                  c.length
                }, next: ${res.next.map((g) =>
                  g.toString()
                )}): ${reducerRule.toString()} | ${anotherRule.toString()}`;
                if (debug) console.log(msg);
                else throw new ParserError(ParserErrorType.CONFLICT, msg);
              }
            } else {
              // E is a T, check if A's follow has E
              if (AFollow.has(E)) {
                // auto resolve failed, check if the conflicts are resolved by user
                const res = this.unresolvedConflicts(
                  ConflictType.REDUCE_SHIFT,
                  reducerRule,
                  anotherRule,
                  [new Grammar({ content: E.content, type: GrammarType.T })],
                  false // for a RS conflict, we don't need to handle end of input
                );
                if (res.next.length > 0) {
                  const msg = `Unresolved R-S conflict (length: ${
                    c.length
                  }, next: ${res.next.map((g) =>
                    g.toString()
                  )}): ${reducerRule.toString()} | ${anotherRule.toString()}`;
                  if (debug) console.log(msg);
                  else throw new ParserError(ParserErrorType.CONFLICT, msg);
                }
              }
            }
          } else {
            // E is a literal, check if A's follow has E
            if (AFollow.has(E)) {
              // auto resolve failed, check if the conflicts are resolved by user
              const res = this.unresolvedConflicts(
                ConflictType.REDUCE_SHIFT,
                reducerRule,
                anotherRule,
                [
                  new Grammar({
                    content: E.content,
                    type: GrammarType.LITERAL,
                  }),
                ],
                false // for a RS conflict, we don't need to handle end of input
              );
              if (res.next.length > 0) {
                const msg = `Unresolved R-S conflict (length: ${
                  c.length
                }, next: ${res.next.map((g) =>
                  g.toString()
                )}): ${reducerRule.toString()} | ${anotherRule.toString()}`;
                if (debug) console.log(msg);
                else throw new ParserError(ParserErrorType.CONFLICT, msg);
              }
            }
          }
        });
      }
    }

    // if the tail of a grammar rule is the same as another grammar rule, it's a reduce-reduce conflict
    // e.g. `A B C | B C` is a reduce-reduce conflict
    for (let i = 0; i < this.tempGrammarRules.length; i++) {
      for (let j = 0; j < this.tempGrammarRules.length; j++) {
        if (i == j) continue;
        const reducerRule = this.tempGrammarRules[i];
        const anotherRule = this.tempGrammarRules[j];
        if (reducerRule.checkRRConflict(anotherRule)) {
          // try to auto resolve conflicts if possible
          // e.g. for a reduce-reduce conflict: `A <= B` and `C <= D B`
          // if A's follow has some grammar that is also in C's follow, the conflict can't be resolved by LR1 peeking
          const A = reducerRule.NT;
          const C = anotherRule.NT;
          const overlap = follow.get(A).overlap(follow.get(C));
          if (overlap.length < 0) return; // no overlap, all conflicts can be auto resolved

          // auto resolve failed, check if the conflict is resolved by user
          const res = this.unresolvedConflicts(
            ConflictType.REDUCE_REDUCE,
            reducerRule,
            anotherRule,
            overlap,
            true // for a RR conflict, we need to handle end of input
          );
          if (res.next.length > 0) {
            const msg = `Unresolved R-R conflict (next: ${res.next.map((g) =>
              g.toString()
            )}): ${reducerRule.toString()} | ${anotherRule.toString()}`;
            if (debug) console.log(msg);
            else throw new ParserError(ParserErrorType.CONFLICT, msg);
          }
          if (res.end) {
            const msg = `Unresolved R-R conflict (end of input): ${reducerRule.toString()} | ${anotherRule.toString()}`;
            if (debug) console.log(msg);
            else throw new ParserError(ParserErrorType.CONFLICT, msg);
          }
        }
      }
    }

    return this;
  }

  /**
   * Ensure all grammar rules resolved are appeared in the grammar rules.
   * If ok, return this.
   */
  checkResolved() {
    this.resolved.forEach((g) => {
      if (!this.tempGrammarRules.some((gr) => gr.weakEq(g.reducer)))
        throw new ParserError(
          ParserErrorType.NO_SUCH_GRAMMAR_RULE,
          g.reducer.toString()
        );
      if (!this.tempGrammarRules.some((gr) => gr.weakEq(g.another)))
        throw new ParserError(
          ParserErrorType.NO_SUCH_GRAMMAR_RULE,
          g.another.toString()
        );
    });
    return this;
  }

  /** Shortcut for `this.checkSymbols(Ts).checkConflicts(debug).checkResolved()`.  */
  checkAll(Ts: Set<string>, debug = false) {
    return this.checkSymbols(Ts).checkConflicts(debug).checkResolved();
  }
}
