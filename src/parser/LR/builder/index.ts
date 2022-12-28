import { DFA } from "../DFA";
import { ParserError, ParserErrorType } from "../error";
import { Parser } from "../parser";
import { ConflictType, Definition, ResolvedConflict } from "./model";
import {
  Grammar,
  Callback,
  GrammarRule,
  GrammarType,
  Rejecter,
} from "../model";
import { TempGrammarRule, TempGrammarType } from "./grammar";
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
  private resolved: ResolvedConflict[];

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
  define(defs: Definition, callback?: Callback<T>, rejecter?: Rejecter<T>) {
    const grs = defToTempGRs(defs, callback, rejecter);
    this.tempGrammarRules.push(...grs);
    grs.forEach((gr) => this.NTs.add(gr.NT));

    return this;
  }

  /** Merge grammar rules, NTs and resolved conflicts of another parser builder. */
  use(another: ParserBuilder<T>) {
    this.tempGrammarRules.push(...another.tempGrammarRules);
    this.NTs = new Set([...this.NTs, ...another.NTs]);
    this.resolved.push(...another.resolved);
    return this;
  }

  /** Resolve a conflict. */
  private resolve(type: ConflictType, def1: Definition, def2: Definition) {
    this.resolved.push({
      type,
      rule1: defToTempGRs<void>(def1)[0],
      rule2: defToTempGRs<void>(def2)[0],
    });
    return this;
  }

  /** Resolve a shift-reduce conflict. */
  resolveSR(def1: Definition, def2: Definition) {
    return this.resolve(ConflictType.SHIFT_REDUCE, def1, def2);
  }

  /** Resolve a reduce-reduce conflict. */
  resolveRR(def1: Definition, def2: Definition) {
    return this.resolve(ConflictType.REDUCE_REDUCE, def1, def2);
  }

  /** Return whether a conflict has been resolved. */
  private hasResolvedConflict<_, __>(
    type: ConflictType,
    rule1: TempGrammarRule<_>,
    rule2: TempGrammarRule<__>
  ) {
    return this.resolved.some((r) => {
      if (r.type != type) return false;
      return rule1.weakEq(r.rule1) && rule2.weakEq(r.rule2);
    });
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
   * Ensure all shift-reduce and reduce-reduce conflicts are resolved.
   * If ok, return this.
   */
  checkConflicts(debug = false) {
    const dfa = this.buildDFA();
    const first = dfa.getFirst();
    const follow = dfa.getFollow();

    // if the tail of a grammar rule is the same as the head of another grammar rule, it's a shift-reduce conflict
    // e.g. `exp '+' exp | exp '*' exp` is a shift-reduce conflict, `A B C | B C D` is a shift-reduce conflict
    for (let i = 0; i < this.tempGrammarRules.length; i++) {
      for (let j = 0; j < this.tempGrammarRules.length; j++) {
        if (i == j) continue;
        const gr1 = this.tempGrammarRules[i];
        const gr2 = this.tempGrammarRules[j];
        const conflicts = gr1.checkSRConflict(gr2);
        conflicts.map((c) => {
          // try to auto resolve conflicts if possible
          // e.g. for a shift-reduce conflict: `A <= B C` and `D <= B C E`
          // if E's first set doesn't overlap with A's follow set, the conflict can be resolved by LR1 peeking
          const E = c.shifterRule.rule[c.length];
          const A = c.reducerRule.NT;
          if (E.type == TempGrammarType.GRAMMAR) {
            if (this.NTs.has(E.content)) {
              // E is a NT, check if E's first set doesn't overlap with A's follow set
              if (!first.get(E.content).overlap(follow.get(A))) {
                if (debug)
                  console.log(
                    `Auto Resolved S-R conflict (length ${
                      c.length
                    }): ${c.shifterRule.toString()} | ${c.reducerRule.toString()}`
                  );
                return;
              }
            } else {
              // E is a T, just check if E is in A's follow set
              if (
                !follow
                  .get(A)
                  .has(new Grammar({ type: GrammarType.T, content: E.content }))
              ) {
                if (debug)
                  console.log(
                    `Auto Resolved S-R conflict (length ${
                      c.length
                    }): ${c.shifterRule.toString()} | ${c.reducerRule.toString()}`
                  );
                return;
              }
            }
          } else {
            // E is a literal string, just check if E is in A's follow set
            if (
              !follow
                .get(A)
                .has(
                  new Grammar({ type: GrammarType.LITERAL, content: E.content })
                )
            ) {
              if (debug)
                console.log(
                  `Auto Resolved S-R conflict (length ${
                    c.length
                  }): ${c.shifterRule.toString()} | ${c.reducerRule.toString()}`
                );
              return;
            }
          }

          // auto resolve failed, check if the conflict is resolved by user
          if (!this.hasResolvedConflict(ConflictType.SHIFT_REDUCE, gr1, gr2)) {
            const msg = `Unresolved S-R conflict (length ${
              c.length
            }): ${gr1.toString()} | ${gr2.toString()}`;
            if (debug) console.log(msg);
            else throw new ParserError(ParserErrorType.CONFLICT, msg);
          }
        });
      }
    }

    // if the tail of a grammar rule is the same as another grammar rule, it's a reduce-reduce conflict
    // e.g. `A B C | B C` is a reduce-reduce conflict
    for (let i = 0; i < this.tempGrammarRules.length; i++) {
      for (let j = 0; j < this.tempGrammarRules.length; j++) {
        if (i == j) continue;
        const gr1 = this.tempGrammarRules[i];
        const gr2 = this.tempGrammarRules[j];
        if (gr1.checkRRConflict(gr2)) {
          // try to auto resolve conflicts if possible
          // e.g. for a reduce-reduce conflict: `A <= B` and `C <= D B`
          // if A's follow set doesn't overlap with C's follow set, the conflict can be resolved by LR1 peeking
          const A = gr1.NT;
          const C = gr2.NT;
          if (!follow.get(A).overlap(follow.get(C))) {
            if (debug)
              console.log(
                `Auto Resolved R-R conflict: ${gr1.toString()} | ${gr2.toString()}`
              );
            continue;
          }

          // auto resolve failed, check if the conflict is resolved by user
          if (!this.hasResolvedConflict(ConflictType.REDUCE_REDUCE, gr1, gr2)) {
            const msg = `Unresolved R-R conflict: ${gr1.toString()} | ${gr2.toString()}`;
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
      if (!this.tempGrammarRules.some((gr) => gr.weakEq(g.rule1)))
        throw new ParserError(
          ParserErrorType.NO_SUCH_GRAMMAR_RULE,
          g.rule1.toString()
        );
      if (!this.tempGrammarRules.some((gr) => gr.weakEq(g.rule2)))
        throw new ParserError(
          ParserErrorType.NO_SUCH_GRAMMAR_RULE,
          g.rule2.toString()
        );
    });
    return this;
  }

  /** Shortcut for `this.checkSymbols(Ts).checkConflicts(debug).checkResolved()`.  */
  checkAll(Ts: Set<string>, debug = false) {
    return this.checkSymbols(Ts).checkConflicts(debug).checkResolved();
  }
}
