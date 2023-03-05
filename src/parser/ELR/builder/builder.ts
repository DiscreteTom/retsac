import { GrammarRule, Grammar } from "../model";
import { LR_BuilderError } from "./error";
import { DefinitionContextBuilder } from "./ctx-builder";
import {
  RR_ResolverOptions,
  RS_ResolverOptions,
  TempGrammarRule,
  TempGrammarType,
} from "./model";
import {
  Conflict,
  ConflictType,
  Definition,
  DefinitionContext,
  TempConflict,
} from "./model";
import { defToTempGRs } from "./utils/definition";
import { DFA, DFABuilder } from "../DFA";
import { ILexer } from "../../../lexer";
import { getConflicts } from "./utils/conflict";
import { Parser } from "../parser";

/**
 * Builder for ELR parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * When build, it's recommended to set `checkAll` to `true` when developing.
 */
export class ParserBuilder<T> {
  private tempGrammarRules: TempGrammarRule<T>[];
  private entryNTs: Set<string>;
  private NTs: Set<string>;
  private resolved: TempConflict<T>[];
  private cascadeQueryPrefix?: string;

  constructor(options?: { cascadeQueryPrefix?: string }) {
    this.tempGrammarRules = [];
    this.entryNTs = new Set();
    this.NTs = new Set();
    this.resolved = [];
    this.cascadeQueryPrefix = options?.cascadeQueryPrefix;
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

  /**
   * Ensure all T/NTs have their definitions, and no duplication, and all literals are valid.
   * If ok, return this.
   */
  checkSymbols(Ts: ReadonlySet<string>, lexer: ILexer) {
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

    // all literals must can be tokenized by lexer
    lexer = lexer.dryClone();
    this.tempGrammarRules.forEach((gr) => {
      gr.rule.forEach((grammar) => {
        if (grammar.type == TempGrammarType.LITERAL) {
          if (lexer.reset().lex(grammar.content) == null)
            throw LR_BuilderError.invalidLiteral(grammar.content, gr);
        }
      });
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
          new GrammarRule<T>({
            NT: gr.NT,
            callback: gr.callback ?? (() => {}),
            rejecter: gr.rejecter ?? (() => false),
            rollback: gr.rollback ?? (() => {}),
            commit: gr.commit ?? (() => false),
            traverser: gr.traverser,
            rule: gr.rule.map((g) => g.toGrammar(this.NTs.has(g.content))),
          })
      );
    };

    const grs = getGrammarRules();

    return {
      dfa: new DFA<T>(
        ...DFABuilder.build<T>(grs, this.entryNTs, this.NTs),
        this.cascadeQueryPrefix
      ),
      grs,
    };
  }

  /** Generate the ELR parser. */
  build(
    lexer: ILexer,
    options?: {
      debug?: boolean;
      generateResolvers?: "builder" | "context";
      /** If `printAll` is true, print all errors instead of throwing errors. */
      printAll?: boolean;
      checkSymbols?: boolean;
      checkConflicts?: boolean;
      checkAll?: boolean;
    }
  ) {
    const { dfa, grs } = this.buildDFA();
    dfa.debug = options?.debug ?? false;

    // check symbols first
    if (options?.checkAll || options?.checkSymbols)
      this.checkSymbols(lexer.getTokenTypes(), lexer);

    // deal with conflicts
    if (
      options?.checkAll ||
      options?.checkConflicts ||
      options?.generateResolvers
    ) {
      const conflicts = getConflicts<T>(
        this.entryNTs,
        this.NTs,
        grs,
        this.resolved,
        dfa,
        lexer,
        options?.debug
      );

      if (options?.generateResolvers)
        this.generateResolvers(conflicts, options?.generateResolvers);

      if (options?.checkAll || options?.checkConflicts)
        this.checkConflicts(
          dfa,
          grs,
          conflicts,
          lexer,
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
    grs: GrammarRule<T>[],
    conflicts: Map<GrammarRule<T>, Conflict<T>[]>,
    lexer: ILexer,
    printAll: boolean
  ) {
    const followSets = dfa.getFollowSets();

    // ensure all conflicts are resolved
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
      if (g.next == "*") return;
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
    const allConflicts = [] as Conflict<T>[];
    getConflicts<T>(
      this.entryNTs,
      this.NTs,
      grs,
      [], // ignore user resolve
      dfa,
      lexer,
      false // don't print debug info
    ).forEach((cs) => allConflicts.push(...cs));
    // then, ensure all resolved are in the conflicts
    this.resolved.forEach((c) => {
      // check next
      if (c.next != "*")
        c.next.forEach((n) => {
          if (
            !allConflicts.some(
              (conflict) =>
                c.reducerRule.weakEq(conflict.reducerRule) &&
                c.anotherRule.weakEq(conflict.anotherRule) &&
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

  private generateResolvers(
    conflicts: Map<GrammarRule<T>, Conflict<T>[]>,
    style: "builder" | "context"
  ) {
    if (style == "builder") {
      conflicts.forEach((v, k) => {
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
    options: RS_ResolverOptions<T>
  ) {
    const ctx = new DefinitionContextBuilder<T>()
      .resolveRS(anotherRule, options)
      .build();

    return this.resolve(reducerRule, ctx);
  }

  /** Resolve a reduce-reduce conflict. */
  resolveRR(
    reducerRule: Definition,
    anotherRule: Definition,
    options: RR_ResolverOptions<T>
  ) {
    const ctx = new DefinitionContextBuilder<T>()
      .resolveRR(anotherRule, options)
      .build();

    return this.resolve(reducerRule, ctx);
  }
}
