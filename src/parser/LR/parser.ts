import { Lexer, Token } from "../../lexer/lexer";
import { exact, stringLiteral } from "../../lexer/utils";
import { Parser } from "../model";
import { GrammarCallback, Rejecter } from "../simple/model";
import { DFA } from "./DFA";
import { Grammar, GrammarRule } from "./model";

const grammarLexer = new Lexer()
  .ignore(
    /^\s/ // blank
  )
  .define({
    grammar: /^\w+/,
    or: exact("|"),
    literal: stringLiteral({ single: true, double: true }),
  });

type TempGrammar = {
  type: "literal" | "grammar";
  content: string;
};

type TempGrammarRule = {
  rule: TempGrammar[];
  NT: string; // the reduce target
  callback: GrammarCallback;
  rejecter: Rejecter;
};

type Definition = { [NT: string]: string | string[] };

/**
 * Builder for LR parsers.
 *
 * Use `define` to define grammar rules, use `build` to get parser.
 */
export class LRParserBuilder {
  private tempGrammarRules: TempGrammarRule[];
  private entryNTs: Set<string>;

  constructor() {
    this.tempGrammarRules = [];
    this.entryNTs = new Set();
  }

  /** Top-level NT's. */
  entry(defs: string | string[]) {
    this.entryNTs = new Set(defs instanceof Array ? defs : [defs]);
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

  build(): Parser {
    let NTs = new Set(this.tempGrammarRules.map((gr) => gr.NT));
    let grammarRules = tempGrammarRulesToGrammarRules(
      this.tempGrammarRules,
      NTs
    );
    let dfa = new DFA(grammarRules, this.entryNTs, NTs);

    return (buffer) => {
      return dfa.parse(buffer);
    };
  }

  /**
   * Ensure all symbols have their definitions, and no duplication.
   */
  // checkSymbols(externalSymbols: Set<string>) {
  //   let ntNameSet: Set<string> = new Set(); // non-terminator definitions
  //   let symbolSet: Set<string> = new Set();

  //   // collect NT names and grammars
  //   this.grammarRules.map((g) => {
  //     ntNameSet.add(g.NT);
  //     g.rule.map((grammar) => {
  //       if (grammar.type == "grammar") symbolSet.add(grammar.content);
  //     });
  //   });

  //   // all symbols should have its definition
  //   symbolSet.forEach((symbol) => {
  //     if (!externalSymbols.has(symbol) && !ntNameSet.has(symbol))
  //       throw new Error(`Undefined symbol: ${symbol}`);
  //   });

  //   // check duplication
  //   ntNameSet.forEach((name) => {
  //     if (externalSymbols.has(name))
  //       throw new Error(`Duplicated definition: ${name}`);
  //   });

  //   return this;
  // }
}

function definitionToTempGrammarRules(
  defs: Definition,
  callback?: GrammarCallback,
  rejecter?: Rejecter
) {
  let result: TempGrammarRule[] = [];

  // parse rules
  for (const NT in defs) {
    let rules: Token[][] = [[]];
    let def = defs[NT];
    grammarLexer
      .reset()
      .lexAll(def instanceof Array ? def.join("|") : def)
      .map((t) => {
        if (t.type == "or") rules.push([]);
        else rules.at(-1).push(t);
      });

    if (grammarLexer.hasRest())
      throw new Error(
        `Can't tokenize: "${grammarLexer.getRest()}" in grammar rule: "${
          defs[NT]
        }"`
      );
    if (rules.length == 0 && rules[0].length == 0)
      throw new Error(`Empty rule: "${NT}=>${defs[NT]}"`);

    rules.map((tokens) => {
      let ruleStr = tokens.join(" ");

      if (tokens.length == 0)
        throw new Error(`No grammar or literal in rule '${NT}=>${ruleStr}'`);

      if (
        !tokens
          .filter((t) => t.type == "literal")
          .every((t) => t.content.length > 2)
      )
        throw new Error(
          `Literal value can't be empty in rule '${NT}=>${ruleStr}'`
        );

      result.push({
        NT,
        rule: tokens.map((t) => {
          if (t.type == "grammar")
            return {
              type: "grammar",
              content: t.content,
            };
          else
            return {
              type: "literal",
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
                g.type == "literal" ? g.type : NTs.has(g.content) ? "NT" : "T",
            })
        ),
      })
  );
}
