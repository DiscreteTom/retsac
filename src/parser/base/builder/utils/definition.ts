import { Lexer } from "../../../..";
import { exact, stringLiteral } from "../../../../lexer";
import { Token } from "../../../../lexer/model";
import { LR_BuilderError } from "../error";
import { Definition, DefinitionContext } from "../model";
import { TempGrammar, TempGrammarRule, TempGrammarType } from "../temp-grammar";

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

/** Definition to TempGrammarRules. */
export function defToTempGRs<T>(defs: Definition, ctx?: DefinitionContext<T>) {
  const result: TempGrammarRule<T>[] = [];

  // parse rules
  for (const NT in defs) {
    /** `[grammar rule index][token index]` */
    const rules: Token[][] = [[]];
    const def = defs[NT];
    const defStr = def instanceof Array ? def.join("|") : def;
    grammarLexer
      .reset()
      .lexAll(defStr)
      .map((t) => {
        if (t.type == "or") rules.push([]); // new grammar rule
        else rules.at(-1)!.push(t); // append token to the last grammar rule
      });

    if (grammarLexer.hasRest())
      throw LR_BuilderError.tokenizeGrammarRuleFailed(
        defStr,
        grammarLexer.getRest()
      );
    if (rules.length == 1 && rules[0].length == 0)
      throw LR_BuilderError.emptyRule(NT, defStr);

    rules.map((tokens) => {
      const ruleStr = tokens.map((t) => t.content).join(" ");

      if (tokens.length == 0) throw LR_BuilderError.emptyRule(NT, defStr);

      if (
        !tokens
          .filter((t) => t.type == "literal")
          .every((t) => t.content.length > 2)
      )
        throw LR_BuilderError.emptyLiteral(NT, ruleStr);

      result.push(
        new TempGrammarRule<T>({
          NT,
          rule: tokens.map((t) => {
            if (t.type == "grammar")
              return new TempGrammar({
                type: TempGrammarType.GRAMMAR,
                content: t.content,
              });
            else
              return new TempGrammar({
                type: TempGrammarType.LITERAL,
                content: t.content.slice(1, -1), // remove quotes
              });
          }),
          callback: ctx?.callback,
          rejecter: ctx?.rejecter,
        })
      );
    });
  }
  return result;
}
