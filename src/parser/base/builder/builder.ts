import { BaseParserContext, GrammarRule } from "../model";
import { LR_BuilderError } from "./error";
import {
  BaseDefinitionContextBuilder,
  RR_ResolverOptions,
} from "./ctx-builder";
import { TempGrammarRule, TempGrammarType } from "./temp-grammar";
import {
  Accepter,
  ConflictType,
  Definition,
  DefinitionContext,
  TempConflict,
} from "./model";
import { defToTempGRs } from "./utils/definition";
import { BaseCandidate } from "../DFA/candidate";
import { BaseState } from "../DFA/state";
import { BaseDFA } from "../DFA/DFA";
import { ILexer } from "../../../lexer";
import { BaseParser } from "../parser";
import { getConflicts } from "./utils/conflict";

/**
 * Builder for LR(1) parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * It's recommended to use `checkAll` before `build` when debug.
 */
export class BaseParserBuilder<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Candidate extends BaseCandidate<T, After, Ctx, Candidate>,
  State extends BaseState<T, After, Ctx, Candidate, State>,
  DFA extends BaseDFA<T, After, Ctx, Candidate, State>,
  Parser extends BaseParser<T, DFA, Parser>,
  DefinitionContextBuilder extends BaseDefinitionContextBuilder<T, After, Ctx>
> {
  protected tempGrammarRules: TempGrammarRule<T, After, Ctx>[];
  protected entryNTs: Set<string>;
  protected NTs: Set<string>;
  protected resolved: TempConflict<T, After, Ctx>[];
  private DFAClass: new (
    allGrammarRules: readonly GrammarRule<T, After, Ctx>[],
    entryNTs: ReadonlySet<string>,
    NTs: ReadonlySet<string>
  ) => DFA;
  private ParserClass: new (dfa: DFA, lexer: ILexer) => Parser;
  private DefinitionContextBuilderClass: new () => DefinitionContextBuilder;

  constructor(
    DFAClass: new (
      allGrammarRules: readonly GrammarRule<T, After, Ctx>[],
      entryNTs: ReadonlySet<string>,
      NTs: ReadonlySet<string>
    ) => DFA,
    ParserClass: new (dfa: DFA, lexer: ILexer) => Parser,
    DefinitionContextBuilderClass: new () => DefinitionContextBuilder
  ) {
    this.tempGrammarRules = [];
    this.entryNTs = new Set();
    this.NTs = new Set();
    this.resolved = [];

    this.DFAClass = DFAClass;
    this.ParserClass = ParserClass;
    this.DefinitionContextBuilderClass = DefinitionContextBuilderClass;
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
    ctxBuilder?: BaseDefinitionContextBuilder<T, After, Ctx>
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
  use(
    another: BaseParserBuilder<
      T,
      After,
      Ctx,
      Candidate,
      State,
      DFA,
      Parser,
      DefinitionContextBuilder
    >
  ) {
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
        new GrammarRule<T, After, Ctx>({
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

  private buildDFA() {
    if (this.entryNTs.size == 0) throw LR_BuilderError.noEntryNT();

    return new this.DFAClass(this.getGrammarRules(), this.entryNTs, this.NTs);
  }

  /** Generate the LR(1) parser. */
  build(lexer: ILexer, debug = false) {
    const dfa = this.buildDFA();
    dfa.debug = debug;

    return new this.ParserClass(dfa, lexer);
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
    const dfa = this.buildDFA();
    const conflicts = getConflicts<T, After, Ctx, Candidate, State, DFA>(
      this.entryNTs,
      this.NTs,
      this.getGrammarRules(),
      this.resolved,
      dfa,
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
    const dfa = this.buildDFA();
    const conflicts = getConflicts<T, After, Ctx, Candidate, State, DFA>(
      this.entryNTs,
      this.NTs,
      this.getGrammarRules(),
      this.resolved,
      dfa,
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
    ctx: DefinitionContext<T, After, Ctx>
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
      reduce?: boolean | Accepter<T, After, Ctx>;
    }
  ) {
    const ctx = new this.DefinitionContextBuilderClass()
      .resolveRS(anotherRule, options)
      .build();

    return this.resolve(reducerRule, ctx);
  }

  /** Resolve a reduce-reduce conflict. */
  resolveRR(
    reducerRule: Definition,
    anotherRule: Definition,
    options: RR_ResolverOptions<T, After, Ctx>
  ) {
    const ctx = new this.DefinitionContextBuilderClass()
      .resolveRR(anotherRule, options)
      .build();

    return this.resolve(reducerRule, ctx);
  }

  /** Shortcut for `this.checkSymbols(Ts).checkConflicts(lexer, printAll)`.  */
  checkAll(Ts: ReadonlySet<string>, lexer?: ILexer, printAll = false) {
    return this.checkSymbols(Ts).checkConflicts(lexer, printAll);
  }
}
