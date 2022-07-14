import { Lexer } from "../../";
import { exact, stringLiteral } from "../../lexer/utils";
import { IParser } from "../model";
import {
  GrammarCallback,
  Rejecter,
  Grammar,
  GrammarRule,
  GrammarType,
} from "./model";
import { DFA } from "./DFA";
import { ASTNode } from "../ast";
import { Token } from "../../lexer/model";
import { ParserError, ParserErrorType } from "./error";

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
type TempGrammar = {
  type: TempGrammarType;
  /** Literal content, or T/NT's type name. */
  content: string;
};

type TempGrammarRule<T> = {
  rule: TempGrammar[];
  /** The reduce target. */
  NT: string;
  callback?: GrammarCallback<T>;
  rejecter?: Rejecter<T>;
};

type Definition = { [NT: string]: string | string[] };

/** LR(1) parser. Stateless. Try to yield a top level NT each time. */
export class Parser<T> implements IParser<T> {
  dfa: DFA<T>;

  constructor(dfa: DFA<T>) {
    this.dfa = dfa;
  }

  /** Try to yield a top level NT. */
  parse(buffer: ASTNode<T>[]) {
    return this.dfa.parse(buffer);
  }

  /** Actually this does nothing since each `DFA.parse` will reset itself. */
  reset() {
    // this.dfa.reset();
  }
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

  constructor() {
    this.tempGrammarRules = [];
    this.entryNTs = new Set();
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

  /** Generate the LR(1) parser. */
  build(debug = false) {
    if (this.entryNTs.size == 0)
      throw new ParserError(
        ParserErrorType.NO_ENTRY_NT,
        `Please set entry NTs for LR Parser.`
      );

    let NTs = new Set(this.tempGrammarRules.map((gr) => gr.NT));
    let grammarRules = tempGrammarRulesToGrammarRules(
      this.tempGrammarRules,
      NTs
    );
    let dfa = new DFA<T>(grammarRules, this.entryNTs, NTs);
    dfa.debug = debug;

    return new Parser<T>(dfa);
  }

  /**
   * Ensure all T/NTs have their definitions, and no duplication.
   */
  checkSymbols(Ts: Set<string>) {
    /** Non-terminator definitions. */
    let NTs: Set<string> = new Set();
    /** T/NT names. */
    let grammarSet: Set<string> = new Set();

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
}

function definitionToTempGrammarRules<T>(
  defs: Definition,
  callback?: GrammarCallback<T>,
  rejecter?: Rejecter<T>
) {
  let result: TempGrammarRule<T>[] = [];

  // parse rules
  for (const NT in defs) {
    /** `[grammar rule index][token index]` */
    let rules: Token[][] = [[]];
    let def = defs[NT];
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
      let ruleStr = tokens.map((t) => t.content).join(" ");

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
