import {
  BaseParserContext,
  CandidateClassCtor,
  DFAClassCtor,
  GrammarRule,
  ParserClassCtor,
  StateClassCtor,
} from "../model";
import { LR_BuilderError } from "./error";
import {
  BaseDefinitionContextBuilder,
  RR_ResolverOptions,
} from "./ctx-builder";
import { TempGrammarRule, TempGrammarType } from "./temp-grammar";
import {
  Accepter,
  Conflict,
  ConflictType,
  Definition,
  DefinitionContext,
  DefinitionContextBuilderClassCtor,
  TempConflict,
} from "./model";
import { defToTempGRs } from "./utils/definition";
import { BaseCandidate, BaseState, BaseDFA, DFABuilder } from "../DFA";
import { ILexer } from "../../../lexer";
import { BaseParser } from "../parser";
import { getConflicts } from "./utils/conflict";

/**
 * Base builder for LR and Expectational LR parsers.
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

  constructor(
    private readonly CandidateClass: CandidateClassCtor<
      T,
      After,
      Ctx,
      Candidate
    >,
    private readonly StateClass: StateClassCtor<
      T,
      After,
      Ctx,
      Candidate,
      State
    >,
    private readonly DFAClass: DFAClassCtor<
      T,
      After,
      Ctx,
      Candidate,
      State,
      DFA
    >,
    private readonly ParserClass: ParserClassCtor<
      T,
      After,
      Ctx,
      Candidate,
      State,
      DFA,
      Parser
    >,
    private readonly DefinitionContextBuilderClass: DefinitionContextBuilderClassCtor<
      T,
      After,
      Ctx
    >
  ) {
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

    /**
     * Turn temp grammar rules to grammar rules according to the known NTs.
     * This should be called only if no more definitions will be defined.
     */
    const getGrammarRules = () => {
      return this.tempGrammarRules.map(
        (gr) =>
          new GrammarRule<T, After, Ctx>({
            NT: gr.NT,
            callback: gr.callback,
            rejecter: gr.rejecter,
            rule: gr.rule.map((g) => g.toGrammar(this.NTs.has(g.content))),
          })
      );
    };

    const grs = getGrammarRules();

    return {
      dfa: new this.DFAClass(
        ...DFABuilder.build<T, After, Ctx, Candidate, State>(
          grs,
          this.entryNTs,
          this.NTs,
          this.CandidateClass,
          this.StateClass
        )
      ),
      grs,
    };
  }

  /** Generate the LR or ELR parser. */
  build(lexer: ILexer, debug = false) {
    const { dfa } = this.buildDFA();
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
    const { dfa, grs } = this.buildDFA();
    const conflicts = getConflicts<T, After, Ctx, Candidate, State, DFA>(
      this.entryNTs,
      this.NTs,
      grs,
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

    // ensure all resolved are indeed conflicts
    // first, re-calculate all conflicts, ignore user resolve
    const allConflicts = [] as Conflict<T, After, Ctx>[];
    getConflicts<T, After, Ctx, Candidate, State, DFA>(
      this.entryNTs,
      this.NTs,
      grs,
      [], // ignore user resolve
      dfa,
      lexer,
      false // don't print debug info
    ).forEach((cs) => allConflicts.push(...cs));
    // then, ensure all resolved are in the conflicts
    this.resolved.every((c) => {
      // check next
      c.next.forEach((n) => {
        if (
          !allConflicts.some(
            (conflict) =>
              c.reducerRule.weakEq(conflict.reducerRule) &&
              c.anotherRule.weakEq(conflict.anotherRule) &&
              c.type == conflict.type &&
              conflict.next.some((nn) => n.eq(nn))
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
        c.handleEnd &&
        !allConflicts.some(
          (conflict) =>
            c.reducerRule.weakEq(conflict.reducerRule) &&
            c.anotherRule.weakEq(conflict.anotherRule) &&
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

  /**
   * This action requires a lexer to calculate literal's type name.
   * If you don't use literal grammar in your rules, you can omit the lexer.
   */
  generateResolvers(
    lexer?: ILexer,
    style?: "builder" | "context",
    debug = false
  ) {
    style ??= "builder";
    const { dfa, grs } = this.buildDFA();
    const conflicts = getConflicts<T, After, Ctx, Candidate, State, DFA>(
      this.entryNTs,
      this.NTs,
      grs,
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

  /** Shortcut for `this.checkSymbols(Ts).checkConflicts(lexer, printAll, debug)`.  */
  checkAll(
    Ts: ReadonlySet<string>,
    lexer?: ILexer,
    printAll = false,
    debug = false
  ) {
    return this.checkSymbols(Ts).checkConflicts(lexer, printAll, debug);
  }
}
