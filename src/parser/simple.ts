import { Lexer, Token } from "../lexer/lexer";
import { exact, from_to } from "../lexer/utils";
import { ASTData, ASTNode } from "./ast";
import { Reducer } from "./parser";

export class SimpleReducer {
  private grammarRules: GrammarRule[];

  constructor() {
    this.grammarRules = [];
  }

  define(defs: { [NT: string]: string }, callback?: GrammarCallback) {
    callback ??= () => {};

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
        });
      });
    }

    return this;
  }

  compile() {
    return new Reducer((buffer, rest) => {
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
          if (grammarRule.callback(context) != "reject") {
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

export type GrammarCallback = (context: ReducerContext) => "reject" | any;

export function valueReducer(f: (values: any[]) => any): GrammarCallback {
  return ({ matched, data }) =>
    (data.value = f(matched.map((node) => node.data.value)));
}

export function dataReducer(f: (data: any[]) => any): GrammarCallback {
  return (context) =>
    (context.data = f(context.matched.map((node) => node.data)));
}

export type GrammarRule = {
  rule: Grammar[]; // a list of Ts or NTs or literal strings
  NT: string; // the reduce target
  callback: GrammarCallback;
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
