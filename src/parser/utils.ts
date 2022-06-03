import { Lexer, Token } from "../lexer/lexer";
import { exact, from_to } from "../lexer/utils";
import { ASTData, ASTNode } from "./ast";
import { Reducer } from "./custom-parser";

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

export type GrammarRule = {
  rule: Grammar[]; // a list of Ts or NTs or literal strings
  NT: string; // the reduce target
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

export function match(
  defs: { [NT: string]: string },
  cb?: (context: ReducerContext) => "reject" | void
): Reducer {
  cb ??= () => {};

  // parse rules
  let grammarRules: GrammarRule[] = [];
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

      grammarRules.push({
        NT,
        rule: tokens.map((t) => {
          if (t.type == "grammar")
            return {
              type: "grammar",
              name: t.content,
            };
        }),
      });
    });
  }

  return new Reducer((buffer, rest) => {
    // traverse all grammar rules
    for (const grammarRule of grammarRules) {
      if (matchRule(buffer, grammarRule)) {
        let context: ReducerContext = {
          data: { value: null },
          matched: buffer.slice(-1 - grammarRule.rule.length, -1),
          before: buffer.slice(0, -1 - grammarRule.rule.length),
          after: rest,
          error: "",
        };
        if (cb(context) != "reject") {
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

function matchRule(buffer: ASTNode[], grammarRule: GrammarRule) {
  if (buffer.length < grammarRule.rule.length) return false;
  const tail = buffer.slice(-1 - grammarRule.rule.length, -1);

  for (let i = 0; i < grammarRule.rule.length; ++i) {
    let grammar = grammarRule.rule[i];
    if (grammar.type == "grammar" && tail[i].type == grammar.name) continue;
    if (grammar.type == "literal" && tail[i].text == grammar.content) continue;
    return false;
  }
  return true;
}
