import { GrammarRule } from "../model";
import { LR_BuilderError } from "./error";
import { BaseDefinitionContextBuilder } from "./ctx-builder";
import { TempGrammarRule, TempGrammarType } from "./temp-grammar";
import { Definition, TempConflict } from "./model";
import { defToTempGRs } from "./utils/definition";

/**
 * Builder for LR(1) parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * It's recommended to use `checkAll` before `build` when debug.
 */
export class BaseParserBuilder<T, After> {
  protected tempGrammarRules: TempGrammarRule<T, After>[];
  protected entryNTs: Set<string>;
  protected NTs: Set<string>;
  protected resolved: TempConflict<T, After>[];

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
  define(
    defs: Definition,
    ctxBuilder?: BaseDefinitionContextBuilder<T, After>
  ) {
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
  use(another: BaseParserBuilder<T, After>) {
    this.tempGrammarRules.push(...another.tempGrammarRules);
    this.NTs = new Set([...this.NTs, ...another.NTs]);
    this.resolved.push(...another.resolved);
    return this;
  }

  /**
   * Turn temp grammar rules to grammar rules according to the known NTs.
   * This should be called only if no more definitions will be defined.
   */
  protected getGrammarRules() {
    return this.tempGrammarRules.map(
      (gr) =>
        new GrammarRule<T, After>({
          NT: gr.NT,
          callback: gr.callback,
          rejecter: gr.rejecter,
          rule: gr.rule.map((g) => g.toGrammar(this.NTs.has(g.content))),
        })
    );
  }

  /**
   * Ensure all T/NTs have their definitions, and no duplication.
   * If ok, return this.
   */
  checkSymbols(Ts: ReadonlySet<string>) {
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
}
