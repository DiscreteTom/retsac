import { Lexer } from "../../";
import { exact, stringLiteral } from "../../lexer/utils";
import { Parser } from "../model";
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

type TempGrammarRule = {
  rule: TempGrammar[];
  /** The reduce target. */
  NT: string;
  callback?: GrammarCallback;
  rejecter?: Rejecter;
};

type Definition = { [NT: string]: string | string[] };

/** LR(1) parser. Stateless. Try to yield a top level NT each time. */
export class LRParser implements Parser {
  dfa: DFA;

  constructor(dfa: DFA) {
    this.dfa = dfa;
  }

  /** Try to yield a top level NT. */
  parse(buffer: ASTNode[]) {
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
export class LRParserBuilder {
  private tempGrammarRules: TempGrammarRule[];
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
  define(defs: Definition, callback?: GrammarCallback, rejecter?: Rejecter) {
    this.tempGrammarRules.push(
      ...definitionToTempGrammarRules(defs, callback, rejecter)
    );

    return this;
  }

  /** Generate the LR(1) parser. */
  build(debug = false) {
    if (this.entryNTs.size == 0)
      throw new Error(`Please set entry NTs for LR Parser.`);

    let NTs = new Set(this.tempGrammarRules.map((gr) => gr.NT));
    let grammarRules = tempGrammarRulesToGrammarRules(
      this.tempGrammarRules,
      NTs
    );
    let dfa = new DFA(grammarRules, this.entryNTs, NTs);
    dfa.debug = debug;

    return new LRParser(dfa);
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
        throw new Error(`Undefined grammar symbol: ${g}`);
    });

    // check duplication
    NTs.forEach((name) => {
      if (Ts.has(name))
        throw new Error(`Duplicated definition for grammar symbol: ${name}`);
    });

    // entry NTs must in NTs
    this.entryNTs.forEach((NT) => {
      if (!NTs.has(NT)) throw new Error(`Undefined entry NT: "${NT}"`);
    });

    return this;
  }
}

function definitionToTempGrammarRules(
  defs: Definition,
  callback?: GrammarCallback,
  rejecter?: Rejecter
) {
  let result: TempGrammarRule[] = [];

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
      throw new Error(
        `Can't tokenize: "${grammarLexer.getRest()}" in grammar rule: "${
          defs[NT]
        }"`
      );
    if (rules.length == 0 && rules[0].length == 0)
      throw new Error(`Empty rule: "${NT} => ${defs[NT]}"`);

    rules.map((tokens) => {
      let ruleStr = tokens.map((t) => t.content).join(" ");

      if (tokens.length == 0)
        throw new Error(`No grammar or literal in rule '${NT} => ${ruleStr}'`);

      if (
        !tokens
          .filter((t) => t.type == "literal")
          .every((t) => t.content.length > 2)
      )
        throw new Error(
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

function tempGrammarRulesToGrammarRules(
  temp: TempGrammarRule[],
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
