import { ILexer } from "../../../lexer/model";
import { DFA } from "../DFA";
import { GrammarRule } from "../model";
import { Parser } from "../parser";
import { LR_BuilderError } from "./error";
import { DefinitionContextBuilder, RR_ResolverOptions } from "./ctx-builder";
import { TempGrammarRule, TempGrammarType } from "./temp-grammar";
import {
  Definition,
  ConflictType,
  TempConflict,
  Accepter,
  DefinitionContext,
} from "./model";
import { defToTempGRs } from "./utils/definition";
import { getConflicts } from "./utils/conflict";

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
  private resolved: TempConflict<T>[];

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
          rule: gr.rule.map((g) => g.toGrammar(this.NTs.has(g.content))),
        })
    );
  }

  private buildDFA() {
    if (this.entryNTs.size == 0) throw LR_BuilderError.noEntryNT();

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
  checkSymbols(Ts: Readonly<Set<string>>) {
    /** T/NT names. */
    const grammarSet: Set<string> = new Set();

    // collect T/NT names in temp grammar rules
    this.tempGrammarRules.map((g) => {
      g.rule.map((grammar) => {
        if (grammar.type == TempGrammarType.GRAMMAR)
          grammarSet.add(grammar.content);
      });
    });

    // all symbols should have its definition
    grammarSet.forEach((g) => {
      if (!Ts.has(g) && !this.NTs.has(g))
        throw LR_BuilderError.unknownGrammar(g);
    });

    // check duplication
    this.NTs.forEach((name) => {
      if (Ts.has(name)) throw LR_BuilderError.duplicatedDefinition(name);
    });

    // entry NTs must in NTs
    this.entryNTs.forEach((NT) => {
      if (!this.NTs.has(NT)) throw LR_BuilderError.unknownEntryNT(NT);
    });

    return this;
  }

  /**
   * Ensure all reduce-shift and reduce-reduce conflicts are resolved.
   * If ok, return this.
   * This action requires a lexer to calculate literal's type name.
   * If you don't use literal grammar in your rules, you can omit the lexer.
   */
  checkConflicts(lexer?: ILexer, printAll = false, debug = false) {
    const { conflicts, dfa } = getConflicts(
      this.entryNTs,
      this.NTs,
      this.getGrammarRules(),
      this.resolved,
      lexer,
      debug
    );
    const followSets = dfa.getFollowSets();

    conflicts.forEach((cs) => {
      cs.forEach((c) => {
        const err = LR_BuilderError.conflict(c);
        if (printAll) console.log(err.message);
        else throw err;
      });
    });

    // ensure all grammar rules resolved are appeared in the grammar rules
    this.resolved.forEach((g) => {
      // reducer rule must be in grammar rules, because we already checked it in this.resolve()
      // so we can omit this check
      // if (!this.tempGrammarRules.some((gr) => gr.weakEq(g.reducerRule))) {
      //   const errMsg = `No such grammar rule: ${g.reducerRule.toString()}`;
      //   if (printAll) console.log(errMsg);
      //   else
      //     throw new ParserError(ParserErrorType.NO_SUCH_GRAMMAR_RULE, errMsg);
      // }
      if (!this.tempGrammarRules.some((gr) => gr.weakEq(g.anotherRule))) {
        const err = LR_BuilderError.grammarRuleNotFound(g.anotherRule);
        if (printAll) console.log(err.message);
        else throw err;
      }
    });

    // ensure all next grammars in resolved rules indeed in the follow set of the reducer rule's NT
    this.resolved.forEach((g) => {
      g.next.forEach((n) => {
        if (
          !followSets
            .get(g.reducerRule.NT)!
            .has(n.toGrammar(this.NTs.has(n.content)))
        ) {
          const err = LR_BuilderError.nextGrammarNotFound(n, g.reducerRule.NT);
          if (printAll) console.log(err.message);
          else throw err;
        }
      });
    });

    // TODO: ensure all resolved are indeed conflicts
    return this;
  }

  /**
   * This action requires a lexer to calculate literal's type name.
   * If you don't use literal grammar in your rules, you can omit the lexer.
   */
  generateResolver(
    lexer?: ILexer,
    style?: "builder" | "context",
    debug = false
  ) {
    style ??= "builder";

    const { conflicts } = getConflicts(
      this.entryNTs,
      this.NTs,
      this.getGrammarRules(),
      this.resolved,
      lexer,
      debug
    );

    if (style == "builder") {
      conflicts.forEach((v, k) => {
        const txt = v
          .map(
            (c) =>
              `.resolve${
                c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
              }(${c.reducerRule.toString()}, ${c.anotherRule.toString()}, { ${
                c.next.length > 0
                  ? `next: \`${c.next.map((g) => g.toString()).join(" ")}\`, `
                  : ""
              }${c.handleEnd ? `handleEnd: true, ` : ""}reduce: true })`
          )
          .join("\n");
        console.log(txt);
      });
    } else {
      conflicts.forEach((v, k) => {
        const txt =
          `=== ${k.toString()} ===\nLR` +
          v
            .map(
              (c) =>
                `.resolve${
                  c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
                }(${c.anotherRule.toString()}, { ${
                  c.next.length > 0
                    ? `next: \`${c.next.map((g) => g.toString()).join(" ")}\`, `
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

  private resolve(reducerRule: Definition, ctx: DefinitionContext<T>) {
    const grs = defToTempGRs(reducerRule, ctx);

    // update resolved
    grs.forEach((gr) => {
      this.resolved.push(
        ...ctx.resolved.map((r) => ({
          ...r,
          reducerRule: gr,
        }))
      );
    });

    // apply rejecter
    grs.forEach((gr) => {
      // find the grammar rule
      const idx = this.tempGrammarRules.findIndex((g) => g.weakEq(gr));
      if (idx < 0) throw LR_BuilderError.grammarRuleNotFound(gr);
      // apply rejecter
      const r = this.tempGrammarRules[idx].rejecter;
      this.tempGrammarRules[idx].rejecter = (ctx) =>
        (r?.(ctx) ?? false) || gr.rejecter!(ctx);
    });

    return this;
  }

  /** Resolve a reduce-shift conflict. */
  resolveRS(
    reducerRule: Definition,
    anotherRule: Definition,
    options: { next: string; reduce?: boolean | Accepter<T> }
  ) {
    const ctx = DefinitionContextBuilder.resolveRS<T>(
      anotherRule,
      options
    ).build();

    return this.resolve(reducerRule, ctx);
  }

  /** Resolve a reduce-reduce conflict. */
  resolveRR(
    reducerRule: Definition,
    anotherRule: Definition,
    options: RR_ResolverOptions<T>
  ) {
    const ctx = DefinitionContextBuilder.resolveRR<T>(
      anotherRule,
      options
    ).build();

    return this.resolve(reducerRule, ctx);
  }

  /** Shortcut for `this.checkSymbols(Ts).checkConflicts(lexer, printAll)`.  */
  checkAll(Ts: Readonly<Set<string>>, lexer?: ILexer, printAll = false) {
    return this.checkSymbols(Ts).checkConflicts(lexer, printAll);
  }
}
