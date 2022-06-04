import { Lexer, Token } from "../lexer/lexer";
import { exact, from_to } from "../lexer/utils";
import { ASTData, ASTNode } from "./ast";
import { NodeReducer } from "./parser";

/**
 * Use `define` to define grammar rules, use `compile` to get reducer.
 */
export class SimpleNodeReducer {
  private grammarRules: GrammarRule[];

  constructor() {
    this.grammarRules = [];
  }

  /**
   * Definition syntax:
   * - `A | B` means `A` or `B`
   * - `A B` means `A` then `B`
   * - `'xxx'` or `"xxx"` means literal string `xxx`
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
      syntaxLexer
        .reset()
        .lexAll(defs[NT])
        .map((t) => {
          if (t.type == "or") rules.push([]);
          else rules.at(-1).push(t);
        });

      if (syntaxLexer.hasRest())
        throw new Error(
          `Can't tokenize: "${syntaxLexer.getRest()}" in grammar rule: "${
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

  compile() {
    return new NodeReducer((buffer, rest) => {
      // traverse all grammar rules
      for (const grammarRule of this.grammarRules) {
        if (matchRule(buffer, grammarRule)) {
          let context: ReducerContext = {
            data: { value: null },
            matched: buffer.slice(-grammarRule.rule.length),
            before: buffer.slice(0, -grammarRule.rule.length),
            after: rest,
            error: "",
          };
          grammarRule.callback(context);
          if (!grammarRule.rejecter(context)) {
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
    });
  }

  /**
   * Ensure all symbols have their definitions, and no duplication.
   */
  checkSymbols(terminatorSet: Set<string>) {
    let ntNameSet: Set<string> = new Set(); // non-terminator definitions
    let grammarSet: Set<string> = new Set();

    // collect NT names and grammars
    this.grammarRules.map((g) => {
      ntNameSet.add(g.NT);
      g.rule.map((grammar) => {
        if (grammar.type == "grammar") grammarSet.add(grammar.name);
      });
    });

    // all grammars should have its definition
    grammarSet.forEach((grammar) => {
      if (!terminatorSet.has(grammar) && !ntNameSet.has(grammar))
        throw new Error(`Undefined grammar: ${grammar}`);
    });

    // NTs can't have same name with Ts
    ntNameSet.forEach((name) => {
      if (terminatorSet.has(name))
        throw new Error(`Duplicated definition: ${name}`);
    });

    return this;
  }
}

export type ReducerContext = {
  data: ASTData;
  readonly matched: ASTNode[];
  readonly before: ASTNode[];
  readonly after: ASTNode[];
  error: string;
};

export type Grammar =
  | { type: "literal"; content: string }
  | {
      type: "grammar";
      name: string; // T's or NT's name
    };

export type GrammarCallback = (context: ReducerContext) => void;

export type Rejecter = (context: ReducerContext) => boolean; // return true if conflict

export function dataReducer(
  f: (data: any[], context: ReducerContext) => ASTData
): GrammarCallback {
  return (context) =>
    (context.data = f(
      context.matched.map((node) => node.data),
      context
    ));
}

export function valueReducer(
  f: (values: any[], context: ReducerContext) => any
): GrammarCallback {
  return (context) =>
    (context.data.value = f(
      context.matched.map((node) => node.data.value),
      context
    ));
}

export type GrammarRule = {
  rule: Grammar[]; // a list of Ts or NTs or literal strings
  NT: string; // the reduce target
  callback: GrammarCallback;
  rejecter: Rejecter;
};

const syntaxLexer = new Lexer()
  .ignore(
    /^\s/ // blank
  )
  .define({
    grammar: /^\w+/,
    or: exact("|"),
  })
  .overload({
    literal: [from_to('"', '"', false), from_to("'", "'", false)],
  });

function matchRule(buffer: ASTNode[], grammarRule: GrammarRule) {
  if (buffer.length < grammarRule.rule.length) return false;
  const tail = buffer.slice(-grammarRule.rule.length);

  return grammarRule.rule.every(
    (grammar, i) =>
      (grammar.type == "grammar" && tail[i].type == grammar.name) ||
      (grammar.type == "literal" && tail[i].text == grammar.content)
  );
}
