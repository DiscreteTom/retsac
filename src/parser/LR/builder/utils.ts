import { Lexer } from "../../..";
import { exact, stringLiteral } from "../../../lexer";
import { Token } from "../../../lexer/model";
import { ParserError, ParserErrorType } from "../error";
import { GrammarCallback, Rejecter } from "../model";
import { TempGrammarRule, TempGrammarType } from "./grammar";
import { Definition } from "./model";

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

export function definitionToTempGrammarRules<T>(
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
