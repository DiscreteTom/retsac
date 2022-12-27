import { Lexer } from "../../../../out";
import { exact, stringLiteral } from "../../../lexer/utils";
import { DFA } from "../DFA";
import { Token } from "../../../lexer/model";
import { ParserError, ParserErrorType } from "../error";
import { Parser } from "../parser";
import {
  ConflictType,
  Definition,
  ResolvedConflict,
  TempGrammar,
  TempGrammarRule,
  TempGrammarType,
} from "./model";
import {
  Grammar,
  GrammarCallback,
  GrammarRule,
  GrammarType,
  Rejecter,
} from "../model";

const grammarLexer = new Lexer.Builder()
  .ignore(
    /^\s/ // blank
  )
  .define({
    grammar: /^\w+/,
    or: exact("|"),
    literal: stringLiteral({ single: true, double: true }),
  })
  .build();

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
  private resolved: ResolvedConflict[];

  constructor() {
    this.tempGrammarRules = [];
    this.entryNTs = new Set();
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
    callback?: GrammarCallback<T>,
    rejecter?: Rejecter<T>
  ) {
    this.tempGrammarRules.push(
      ...definitionToTempGrammarRules(defs, callback, rejecter)
    );

    return this;
  }

  /** Merge grammar rules and resolved conflicts of another parser builder. */
  use(another: ParserBuilder<T>) {
    this.tempGrammarRules.push(...another.tempGrammarRules);
    this.resolved.push(...another.resolved);
    return this;
  }

  /** Resolve a conflict. */
  private resolve(type: ConflictType, def1: Definition, def2: Definition) {
    this.resolved.push({
      type,
      rule1: definitionToTempGrammarRules<void>(def1)[0],
      rule2: definitionToTempGrammarRules<void>(def2)[0],
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

  /** Generate the LR(1) parser. */
  build(debug = false) {
    if (this.entryNTs.size == 0)
      throw new ParserError(
        ParserErrorType.NO_ENTRY_NT,
        `Please set entry NTs for LR Parser.`
      );

    const NTs = new Set(this.tempGrammarRules.map((gr) => gr.NT));
    const grammarRules = tempGrammarRulesToGrammarRules(
      this.tempGrammarRules,
      NTs
    );
    const dfa = new DFA<T>(grammarRules, this.entryNTs, NTs);
    dfa.debug = debug;

    return new Parser<T>(dfa);
  }

  /**
   * Ensure all T/NTs have their definitions, and no duplication.
   * If ok, return this.
   */
  checkSymbols(Ts: Set<string>) {
    /** Non-terminator definitions. */
    const NTs: Set<string> = new Set();
    /** T/NT names. */
    const grammarSet: Set<string> = new Set();

    // collect NT definitions and T/NT names in grammar rule
    this.tempGrammarRules.map((g) => {
      NTs.add(g.NT);
      g.rule.map((grammar) => {
        if (grammar.type == TempGrammarType.GRAMMAR)
          grammarSet.add(grammar.content);
      });
    });

    // all symbols should have its definition
    grammarSet.forEach((g) => {
      if (!Ts.has(g) && !NTs.has(g))
        throw new ParserError(
          ParserErrorType.UNDEFINED_GRAMMAR_SYMBOL,
          `Undefined grammar symbol: ${g}`
        );
    });

    // check duplication
    NTs.forEach((name) => {
      if (Ts.has(name))
        throw new ParserError(
          ParserErrorType.DUPLICATED_DEFINITION,
          `Duplicated definition for grammar symbol: ${name}`
        );
    });

    // entry NTs must in NTs
    this.entryNTs.forEach((NT) => {
      if (!NTs.has(NT))
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
    // TODO: auto resolve conflicts if possible
    // e.g. for a shift-reduce conflict: `A <= B C` and `D <= B C E`
    // if E's first set doesn't overlap with A's follow set, the conflict can be resolved by LR1 peeking
    // e.g. for a reduce-reduce conflict: `A <= B` and `C <= D B`
    // if A's follow set doesn't overlap with C's follow set, the conflict can be resolved by LR1 peeking

    // if the tail of a grammar rule is the same as the head of another grammar rule, it's a shift-reduce conflict
    // e.g. `exp '+' exp | exp '*' exp` is a shift-reduce conflict, `A B C | B C D` is a shift-reduce conflict
    for (let i = 0; i < this.tempGrammarRules.length; i++) {
      for (let j = 0; j < this.tempGrammarRules.length; j++) {
        if (i == j) continue;
        const gr1 = this.tempGrammarRules[i];
        const gr2 = this.tempGrammarRules[j];
        const res = gr1.checkShiftReduceConflict(gr2);
        res.map((c) => {
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
        if (gr1.checkReduceReduceConflict(gr2)) {
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

function definitionToTempGrammarRules<T>(
  defs: Definition,
  callback?: GrammarCallback<T>,
  rejecter?: Rejecter<T>
) {
  const result: TempGrammarRule<T>[] = [];

  // parse rules
  for (const NT in defs) {
    /** `[grammar rule index][token index]` */
    const rules: Token[][] = [[]];
    const def = defs[NT];
    grammarLexer
      .reset()
      .lexAll(def instanceof Array ? def.join("|") : def)
      .map((t) => {
        if (t.type == "or") rules.push([]); // new grammar rule
        else rules.at(-1).push(t); // append token to the last grammar rule
      });

    if (grammarLexer.hasRest())
      throw new ParserError(
        ParserErrorType.TOKENIZE_GRAMMAR_RULE_FAILED,
        `Unable to tokenize: "${grammarLexer.getRest()}" in grammar rule: "${
          defs[NT]
        }"`
      );
    if (rules.length == 0 && rules[0].length == 0)
      throw new ParserError(
        ParserErrorType.EMPTY_RULE,
        `Empty rule: "${NT} => ${defs[NT]}"`
      );

    rules.map((tokens) => {
      const ruleStr = tokens.map((t) => t.content).join(" ");

      if (tokens.length == 0)
        throw new ParserError(
          ParserErrorType.EMPTY_RULE,
          `No grammar or literal in rule '${NT} => ${ruleStr}'`
        );

      if (
        !tokens
          .filter((t) => t.type == "literal")
          .every((t) => t.content.length > 2)
      )
        throw new ParserError(
          ParserErrorType.EMPTY_LITERAL,
          `Literal value can't be empty in rule '${NT} => ${ruleStr}'`
        );

      result.push(
        new TempGrammarRule<T>({
          NT,
          rule: tokens.map((t) => {
            if (t.type == "grammar")
              return {
                type: TempGrammarType.GRAMMAR,
                content: t.content,
              };
            else
              return {
                type: TempGrammarType.LITERAL,
                content: t.content.slice(1, -1), // remove quotes
              };
          }),
          callback,
          rejecter,
        })
      );
    });
  }
  return result;
}

function tempGrammarRulesToGrammarRules<T>(
  temp: TempGrammarRule<T>[],
  NTs: Set<string>
) {
  return temp.map(
    (gr) =>
      new GrammarRule({
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
                  : NTs.has(g.content)
                  ? GrammarType.NT
                  : GrammarType.T,
            })
        ),
      })
  );
}
