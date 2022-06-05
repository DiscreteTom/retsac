import { Lexer, Token } from "../../lexer/lexer";
import { exact, stringLiteral } from "../../lexer/utils";
import { ASTNode } from "../ast";
import { Parser } from "../model";
import {
  GrammarCallback,
  GrammarRule,
  ReducerContext,
  Rejecter,
} from "./model";

const grammarLexer = new Lexer()
  .ignore(
    /^\s/ // blank
  )
  .define({
    grammar: /^\w+/,
    or: exact("|"),
    literal: stringLiteral({ single: true, double: true }),
  });

/**
 * Builder for a naive and slow LR(0) parser.
 *
 * Use `define` to define grammar rules, use `build` to get parser.
 */
export class SimpleParserBuilder {
  private grammarRules: GrammarRule[];

  constructor() {
    this.grammarRules = [];
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
   * ```
   */
  define(
    defs: { [NT: string]: string },
    callback?: GrammarCallback,
    rejecter?: Rejecter
  ) {
    callback ??= () => {};
    rejecter ??= () => false;

    // parse rules
    for (const NT in defs) {
      let rules: Token[][] = [[]];
      grammarLexer
        .reset()
        .lexAll(defs[NT])
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

        this.grammarRules.push({
          NT,
          rule: tokens.map((t) => {
            if (t.type == "grammar")
              return {
                type: "grammar",
                name: t.content,
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

    return this;
  }

  build(): Parser {
    let nodeReducer = (current: ASTNode[], rest: ASTNode[]) => {
      // traverse all grammar rules
      for (const grammarRule of this.grammarRules) {
        if (matchRule(current, grammarRule)) {
          let context: ReducerContext = {
            data: { value: null },
            matched: current.slice(-grammarRule.rule.length),
            before: current.slice(0, -grammarRule.rule.length),
            after: rest,
            error: "",
          };
          if (!grammarRule.rejecter(context)) {
            grammarRule.callback(context);
            return {
              accept: true,
              data: context.data,
              digested: grammarRule.rule.length,
              error: context.error,
              type: grammarRule.NT,
            };
          }
          // else, reject, continue to check next rule
        }
      }
      return { accept: false };
    };

    return (buffer) => {
      let tail = 1;
      let accept = false;
      let errors: ASTNode[] = [];
      outer: while (tail <= buffer.length) {
        let res = nodeReducer(buffer.slice(0, tail), buffer.slice(tail));
        if (res.accept) {
          accept = true;
          // construct new node
          let node = new ASTNode({
            type: res.type,
            children: buffer.slice(tail - res.digested, tail),
            error: res.error,
            data: res.data,
          });
          node.children.map((c) => (c.parent = node));

          // update state
          if (node.error) errors.push(node);
          buffer = buffer
            .slice(0, tail - res.digested)
            .concat(node)
            .concat(buffer.slice(tail));

          tail -= res.digested - 1; // consume n, produce 1

          continue outer; // check if we can reduce again with the new tail
        }
        // no rule can't accept, move tail forward
        tail++;
      }

      return accept ? { accept, buffer, errors } : { accept: false };
    };
  }

  /**
   * Ensure all symbols have their definitions, and no duplication.
   */
  checkSymbols(externalSymbols: Set<string>) {
    let ntNameSet: Set<string> = new Set(); // non-terminator definitions
    let symbolSet: Set<string> = new Set();

    // collect NT names and grammars
    this.grammarRules.map((g) => {
      ntNameSet.add(g.NT);
      g.rule.map((grammar) => {
        if (grammar.type == "grammar") symbolSet.add(grammar.name);
      });
    });

    // all symbols should have its definition
    symbolSet.forEach((symbol) => {
      if (!externalSymbols.has(symbol) && !ntNameSet.has(symbol))
        throw new Error(`Undefined symbol: ${symbol}`);
    });

    // check duplication
    ntNameSet.forEach((name) => {
      if (externalSymbols.has(name))
        throw new Error(`Duplicated definition: ${name}`);
    });

    return this;
  }
}

function matchRule(current: ASTNode[], grammarRule: GrammarRule) {
  if (current.length < grammarRule.rule.length) return false;
  const tail = current.slice(-grammarRule.rule.length);

  return grammarRule.rule.every(
    (grammar, i) =>
      (grammar.type == "grammar" && tail[i].type == grammar.name) ||
      (grammar.type == "literal" && tail[i].text == grammar.content)
  );
}
