import { ILexer } from "../../../lexer";
import {
  BaseParserBuilder,
  TempGrammarRule,
  TempConflict,
  Definition,
  GrammarRule,
  TempGrammarType,
  ConflictType,
  DefinitionContext,
  Accepter,
  RR_ResolverOptions,
} from "../../base";
import { LR_BuilderError } from "../../base/builder/error";
import { defToTempGRs } from "../../base/builder/utils/definition";
import { DFA } from "../DFA";
import { ParserContext } from "../model";
import { Parser } from "../parser";
import { DefinitionContextBuilder } from "./ctx-builder";
import { getConflicts } from "./utils/conflict";

/**
 * Builder for Expectational LR(1) parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * It's recommended to use `checkAll` before `build` when debug.
 */
export class ParserBuilder<T> extends BaseParserBuilder<
  T,
  string,
  ParserContext<T>
> {
  constructor() {
    super();
  }

  private buildDFA() {
    if (this.entryNTs.size == 0) throw LR_BuilderError.noEntryNT();

    return new DFA<T>(this.getGrammarRules(), this.entryNTs, this.NTs);
  }

  /** Generate the Expectational LR(1) parser. */
  build(lexer: ILexer, debug = false) {
    const dfa = this.buildDFA();
    dfa.debug = debug;

    return new Parser<T>(dfa, lexer);
  }

  /**
   * Ensure all reduce-shift and reduce-reduce conflicts are resolved.
   * If ok, return this.
   *
   * This action requires a lexer to calculate literal's type name.
   * If you don't use literal grammar in your rules, you can omit the lexer.
   *
   * If `printAll` is true, print all conflicts instead of throwing error.
   *
   * If `debug` is true, print all auto-resolved / user-resolved / unresolved conflicts.
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

  private resolve(
    reducerRule: Definition,
    ctx: DefinitionContext<T, string, ParserContext<T>>
  ) {
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
    options: {
      next: string;
      reduce?: boolean | Accepter<T, string, ParserContext<T>>;
    }
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
    options: RR_ResolverOptions<T, string, ParserContext<T>>
  ) {
    const ctx = DefinitionContextBuilder.resolveRR<T>(
      anotherRule,
      options
    ).build();

    return this.resolve(reducerRule, ctx);
  }

  /** Shortcut for `this.checkSymbols(Ts).checkConflicts(lexer, printAll)`.  */
  checkAll(Ts: ReadonlySet<string>, lexer?: ILexer, printAll = false) {
    return this.checkSymbols(Ts).checkConflicts(lexer, printAll);
  }
}
