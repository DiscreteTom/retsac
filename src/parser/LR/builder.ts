import { Lexer } from "../../";
import { exact, stringLiteral } from "../../lexer/utils";
import {
  GrammarCallback,
  Rejecter,
  Grammar,
  GrammarRule,
  GrammarType,
} from "./model";
import { DFA } from "./DFA";
import { Token } from "../../lexer/model";
import { ParserError, ParserErrorType } from "./error";
import { Parser } from "./parser";

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

/** Grammar type, but can't distinguish N or NT. */
enum TempGrammarType {
  LITERAL,
  /** T or NT */
  GRAMMAR,
}

/** Grammar, but can't distinguish N or NT. */
interface TempGrammar {
  type: TempGrammarType;
  /** Literal content, or T/NT's type name. */
  content: string;
}

interface TempGrammarRule<T> {
  rule: TempGrammar[];
  /** The reduce target. */
  NT: string;
  callback?: GrammarCallback<T>;
  rejecter?: Rejecter<T>;
}

interface Definition {
  [NT: string]: string | string[];
}

enum ConflictType {
  SHIFT_REDUCE,
  REDUCE_REDUCE,
}

interface ResolvedConflict {
  type: ConflictType;
  rule1: TempGrammarRule<void>;
  rule2: TempGrammarRule<void>;
}

/**
 * Builder for LR(1) parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * It's recommended to use `checkSymbols` before `build`.
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
      const r1 = r.rule1;
      const r2 = r.rule2;
      return (
        r1.NT == rule1.NT &&
        r2.NT == rule2.NT &&
        r1.rule.length == rule1.rule.length &&
        r2.rule.length == rule2.rule.length &&
        r1.rule.every((g, i) => g.type == rule1.rule[i].type) &&
        r2.rule.every((g, i) => g.type == rule2.rule[i].type)
      );
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

  checkConflicts(debug = false) {
    // if the tail of a grammar rule is the same as the head of another grammar rule, it's a shift-reduce conflict
    // e.g. `exp '+' exp | exp '*' exp` is a shift-reduce conflict, `A B C | B C D` is a shift-reduce conflict
    for (let i = 0; i < this.tempGrammarRules.length; i++) {
      for (let j = 0; j < this.tempGrammarRules.length; j++) {
        if (i == j) continue;
        const gr1 = this.tempGrammarRules[i];
        const gr2 = this.tempGrammarRules[j];
        const res = checkShiftReduceConflict(gr1, gr2);
        res.map((c) => {
          if (!this.hasResolvedConflict(ConflictType.SHIFT_REDUCE, gr1, gr2)) {
            const msg = `Unresolved S-R conflict (length ${
              c.length
            }): ${tempGrammarRuleToString(gr1)} | ${tempGrammarRuleToString(
              gr2
            )}`;
            if (debug) console.log(msg);
            else throw new ParserError(ParserErrorType.CONFLICT, msg);
          }
        });
      }
    }

    // if the tail of a grammar rule is the same as another grammar rule, it's a reduce-reduce conflict
    for (let i = 0; i < this.tempGrammarRules.length; i++) {
      for (let j = 0; j < this.tempGrammarRules.length; j++) {
        if (i == j) continue;
        const gr1 = this.tempGrammarRules[i];
        const gr2 = this.tempGrammarRules[j];
        if (checkReduceReduceConflict(gr1, gr2)) {
          if (!this.hasResolvedConflict(ConflictType.REDUCE_REDUCE, gr1, gr2)) {
            const msg = `Unresolved R-R conflict: ${tempGrammarRuleToString(
              gr1
            )} | ${tempGrammarRuleToString(gr2)}`;
            if (debug) console.log(msg);
            else throw new ParserError(ParserErrorType.CONFLICT, msg);
          }
        }
      }
    }

    return this;
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

      result.push({
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
      });
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

/** Check if the tail of gr1 is the same as the head of gr2. */
function checkShiftReduceConflict<T>(
  gr1: TempGrammarRule<T>,
  gr2: TempGrammarRule<T>
) {
  const result = [] as {
    gr1: TempGrammarRule<T>;
    gr2: TempGrammarRule<T>;
    length: number;
  }[];
  for (let i = 0; i < gr1.rule.length; ++i) {
    if (ruleStartsWith(gr2.rule, gr1.rule.slice(i))) {
      result.push({
        gr1,
        gr2,
        length: gr1.rule.length - i,
      });
    }
  }
  return result;
}

/** Check if the tail of gr1 is the same as gr2. */
function checkReduceReduceConflict<T>(
  gr1: TempGrammarRule<T>,
  gr2: TempGrammarRule<T>
) {
  return ruleEndsWith(gr1.rule, gr2.rule);
}

/** Return whether rule1 starts with rule2. */
function ruleStartsWith(rule1: TempGrammar[], rule2: TempGrammar[]) {
  if (rule1.length < rule2.length) return false;
  for (let i = 0; i < rule2.length; i++) {
    if (rule1[i].content != rule2[i].content || rule1[i].type != rule2[i].type)
      return false;
  }
  return true;
}

/** Return whether rule1 ends with rule2. */
function ruleEndsWith(rule1: TempGrammar[], rule2: TempGrammar[]) {
  if (rule1.length < rule2.length) return false;
  for (let i = 0; i < rule2.length; i++) {
    if (
      rule1.at(-i - 1).content != rule2.at(-i - 1).content ||
      rule1.at(-i - 1).type != rule2.at(-i - 1).type
    )
      return false;
  }
  return true;
}

function tempGrammarRuleToString<T>(gr: TempGrammarRule<T>) {
  return new GrammarRule({
    NT: gr.NT,
    rule: gr.rule.map(
      (g) =>
        new Grammar({
          type:
            g.type == TempGrammarType.LITERAL
              ? GrammarType.LITERAL
              : GrammarType.NT,
          content: g.content,
        })
    ),
  }).toString();
}
