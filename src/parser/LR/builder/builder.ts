import { DFA } from "../DFA";
import { ParserError, ParserErrorType } from "../error";
import { Grammar, GrammarRule, GrammarSet, GrammarType } from "../model";
import { Parser } from "../parser";
import { DefinitionContextBuilder } from "./ctx-builder";
import { TempGrammarRule, TempGrammar, TempGrammarType } from "./grammar";
import { Definition, ConflictType, Conflict } from "./model";
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
  private resolved: Conflict<T>[];

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
            reducerRule: gr,
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
  private getUnresolvedConflicts<_, __>(
    type: ConflictType,
    reducerRule: TempGrammarRule<_>,
    anotherRule: TempGrammarRule<__>,
    next: Grammar[],
    checkHandleEnd: boolean
  ) {
    const related = this.resolved.filter(
      (r) =>
        r.type == type &&
        reducerRule.weakEq(r.reducerRule) &&
        anotherRule.weakEq(r.anotherRule)
    );

    // check next
    const resolvedNext = [] as TempGrammar[];
    related.forEach((r) => r.next.forEach((n) => resolvedNext.push(n)));
    const unresolvedNext = next.filter(
      (n) => !resolvedNext.some((rn) => n.eq(rn))
    );

    // check end
    const endHandlers = related.filter((r) => r.handleEnd);
    if (endHandlers.length > 1) {
      throw new ParserError(
        ParserErrorType.TOO_MANY_END_HANDLER,
        `Too many end handlers for rule ${endHandlers[0].reducerRule.toString()}`
      );
    }
    const unresolvedEnd = checkHandleEnd
      ? !endHandlers[0]?.handleEnd ?? true
      : false;

    return {
      next: unresolvedNext,
      /** If true, means user didn't handle end of input. */
      end: unresolvedEnd,
    };
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

  /**
   * Return a grammar set contains NTs which might be the last input grammar.
   * E.g. entry NT is A, and we have `A: B C | D E`, then the result will be `{A, C, E}`.
   * This should be called only if no more definitions will be defined.
   */
  private getEndSet() {
    const result = new GrammarSet();
    // entry NTs might be the last input grammar of course
    this.entryNTs.forEach((nt) =>
      result.add(new Grammar({ content: nt, type: GrammarType.NT }))
    );

    while (true) {
      let changed = false;
      this.tempGrammarRules.forEach((gr) => {
        if (result.has(new Grammar({ content: gr.NT, type: GrammarType.NT }))) {
          // current NT is in result, so we need to check its last grammar
          if (
            gr.rule.at(-1).type != TempGrammarType.LITERAL &&
            this.NTs.has(gr.rule.at(-1).content)
          ) {
            // last grammar is a NT, so we need to check it in result
            const last = new Grammar({
              content: gr.rule.at(-1).content,
              type: GrammarType.NT,
            });
            if (!result.has(last)) {
              result.add(last);
              changed = true;
            }
          }
        }
      });
      if (!changed) break;
    }

    return result;
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

  private getConflicts(dfa?: DFA<T>) {
    dfa ??= this.buildDFA();
    const firstSets = dfa.getFirstSets();
    const followSets = dfa.getFollowSets();
    const endSet = this.getEndSet();

    const result = new Map<TempGrammarRule<T>, Conflict<T>[]>();

    // if the tail of a grammar rule is the same as the head of another grammar rule, it's a reduce-shift conflict
    // e.g. `exp '+' exp | exp '*' exp` is a reduce-shift conflict, `A B C | B C D` is a reduce-shift conflict
    for (let i = 0; i < this.tempGrammarRules.length; i++) {
      for (let j = 0; j < this.tempGrammarRules.length; j++) {
        const reducerRule = this.tempGrammarRules[i];
        const anotherRule = this.tempGrammarRules[j];
        const conflicts = reducerRule.checkRSConflict(anotherRule);
        conflicts.map((c) => {
          // try to auto resolve conflicts if possible
          // e.g. for a reduce-shift conflict: `A <= B C` and `D <= C E`
          // if A's follow overlap with E's first, then the conflict can't be auto resolved by LR1 peeking
          const A = c.reducerRule.NT;
          const E = c.shifterRule.rule[c.length];
          const EFirst = firstSets.get(E.content);
          const AFollow = followSets.get(A);
          if (E.type == TempGrammarType.GRAMMAR) {
            if (this.NTs.has(E.content)) {
              // E is a NT, check if A's follow has some grammar that is also in E's first
              const overlap = AFollow.overlap(EFirst);
              if (overlap.length < 0) return; // no overlap, all conflicts can be auto resolved

              // auto resolve failed, check if the conflicts are resolved by user
              const res = this.getUnresolvedConflicts(
                ConflictType.REDUCE_SHIFT,
                reducerRule,
                anotherRule,
                overlap,
                false // for a RS conflict, we don't need to handle end of input
              );

              if (res.next.length > 0) {
                const conflict: Conflict<T> = {
                  type: ConflictType.REDUCE_SHIFT,
                  reducerRule: reducerRule,
                  anotherRule: anotherRule,
                  handleEnd: false,
                  next: res.next.map((g) => ({
                    type:
                      g.type == GrammarType.LITERAL
                        ? TempGrammarType.LITERAL
                        : TempGrammarType.GRAMMAR,
                    content: g.content,
                  })),
                  length: c.length,
                };
                if (result.has(reducerRule))
                  result.get(reducerRule).push(conflict);
                else result.set(reducerRule, [conflict]);
              }
            } else {
              // E is a T, check if A's follow has E
              if (AFollow.has(E)) {
                // auto resolve failed, check if the conflicts are resolved by user
                const res = this.getUnresolvedConflicts(
                  ConflictType.REDUCE_SHIFT,
                  reducerRule,
                  anotherRule,
                  [new Grammar({ content: E.content, type: GrammarType.T })],
                  false // for a RS conflict, we don't need to handle end of input
                );
                if (res.next.length > 0) {
                  const conflict: Conflict<T> = {
                    type: ConflictType.REDUCE_SHIFT,
                    reducerRule: reducerRule,
                    anotherRule: anotherRule,
                    handleEnd: false,
                    next: res.next.map((g) => ({
                      type:
                        g.type == GrammarType.LITERAL
                          ? TempGrammarType.LITERAL
                          : TempGrammarType.GRAMMAR,
                      content: g.content,
                    })),
                    length: c.length,
                  };
                  if (result.has(reducerRule))
                    result.get(reducerRule).push(conflict);
                  else result.set(reducerRule, [conflict]);
                }
              }
            }
          } else {
            // E is a literal, check if A's follow has E
            if (AFollow.has(E)) {
              // auto resolve failed, check if the conflicts are resolved by user
              const res = this.getUnresolvedConflicts(
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
                const conflict: Conflict<T> = {
                  type: ConflictType.REDUCE_SHIFT,
                  reducerRule: reducerRule,
                  anotherRule: anotherRule,
                  handleEnd: false,
                  next: res.next.map((g) => ({
                    type:
                      g.type == GrammarType.LITERAL
                        ? TempGrammarType.LITERAL
                        : TempGrammarType.GRAMMAR,
                    content: g.content,
                  })),
                  length: c.length,
                };
                if (result.has(reducerRule))
                  result.get(reducerRule).push(conflict);
                else result.set(reducerRule, [conflict]);
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
          const overlap = followSets.get(A).overlap(followSets.get(C));
          if (overlap.length < 0) continue; // no overlap, all conflicts can be auto resolved

          // auto resolve failed, check if the conflict is resolved by user
          const res = this.getUnresolvedConflicts(
            ConflictType.REDUCE_REDUCE,
            reducerRule,
            anotherRule,
            overlap,
            // for a RR conflict, we need to handle end of input if both's NT in end sets
            endSet.has(
              new Grammar({ type: GrammarType.NT, content: reducerRule.NT })
            ) &&
              endSet.has(
                new Grammar({ type: GrammarType.NT, content: anotherRule.NT })
              )
          );
          if (res.next.length > 0) {
            const c: Conflict<T> = {
              type: ConflictType.REDUCE_REDUCE,
              reducerRule: reducerRule,
              anotherRule: anotherRule,
              handleEnd: false,
              next: res.next.map((g) => ({
                type:
                  g.type == GrammarType.LITERAL
                    ? TempGrammarType.LITERAL
                    : TempGrammarType.GRAMMAR,
                content: g.content,
              })),
            };
            if (result.has(reducerRule)) result.get(reducerRule).push(c);
            else result.set(reducerRule, [c]);
          }
          if (res.end) {
            const c: Conflict<T> = {
              type: ConflictType.REDUCE_REDUCE,
              reducerRule: reducerRule,
              anotherRule: anotherRule,
              handleEnd: true,
              next: [],
            };
            if (result.has(reducerRule)) result.get(reducerRule).push(c);
            else result.set(reducerRule, [c]);
          }
        }
      }
    }

    return result;
  }

  /**
   * Ensure all reduce-shift and reduce-reduce conflicts are resolved.
   * If ok, return this.
   */
  checkConflicts(printAll = false) {
    const dfa = this.buildDFA();
    const followSets = dfa.getFollowSets();

    this.getConflicts(dfa).forEach((cs) => {
      cs.forEach((c) => {
        const errMsg =
          c.type == ConflictType.REDUCE_SHIFT
            ? `Unresolved R-S conflict (length: ${c.length}, next: \`${c.next
                .map((g) => g.toString())
                .join(
                  " "
                )}\`): ${c.reducerRule.toString()} | ${c.anotherRule.toString()}`
            : `Unresolved R-R conflict (next: \`${c.next
                .map((g) => g.toString())
                .join(
                  " "
                )}\`): ${c.reducerRule.toString()} | ${c.anotherRule.toString()}`;
        if (printAll) console.log(errMsg);
        else throw new ParserError(ParserErrorType.CONFLICT, errMsg);
      });
    });

    // ensure all grammar rules resolved are appeared in the grammar rules
    this.resolved.forEach((g) => {
      if (!this.tempGrammarRules.some((gr) => gr.weakEq(g.reducerRule))) {
        const errMsg = `No such grammar rule: ${g.reducerRule.toString()}`;
        if (printAll) console.log(errMsg);
        else
          throw new ParserError(ParserErrorType.NO_SUCH_GRAMMAR_RULE, errMsg);
      }
      if (!this.tempGrammarRules.some((gr) => gr.weakEq(g.anotherRule))) {
        const errMsg = `No such grammar rule: ${g.anotherRule.toString()}`;
        if (printAll) console.log(errMsg);
        else
          throw new ParserError(ParserErrorType.NO_SUCH_GRAMMAR_RULE, errMsg);
      }
    });

    // ensure all next grammars in resolved rules indeed in the follow set of the reducer rule's NT
    this.resolved.forEach((g) => {
      g.next.forEach((n) => {
        if (!followSets.get(g.reducerRule.NT).has(n)) {
          const errMsg = `Next grammar ${n.toString()} not in follow set of ${g.reducerRule.NT.toString()}`;
          if (printAll) console.log(errMsg);
          else throw new ParserError(ParserErrorType.NO_SUCH_NEXT, errMsg);
        }
      });
    });

    return this;
  }

  generateResolver() {
    this.getConflicts().forEach((v, k) => {
      const txt =
        `=== ${k.toString()} ===\nLR` +
        v
          .map(
            (c) =>
              `.resolve${
                c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
              }(${c.anotherRule.toString()}, { ${
                c.next.length > 0
                  ? `next: \`${c.next
                      .map((g) => Grammar.from(g).toString())
                      .join(" ")}\`, `
                  : ""
              }${c.handleEnd ? `handleEnd: true, ` : ""}reduce: true })`
          )
          .join("\n  ");
      console.log(txt);
      console.log(""); // add a blank line
    });
  }

  /** Shortcut for `this.checkSymbols(Ts).checkConflicts(printAll)`.  */
  checkAll(Ts: Set<string>, printAll = false) {
    return this.checkSymbols(Ts).checkConflicts(printAll);
  }
}
