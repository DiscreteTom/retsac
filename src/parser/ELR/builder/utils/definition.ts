import { Lexer } from "../../../..";
import { exact, stringLiteral } from "../../../../lexer";
import { LR_BuilderError } from "../error";
import { Definition, DefinitionContext } from "../model";
import { TempGrammar, TempGrammarRule, TempGrammarType } from "../model";

const grammarLexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces())
  .define({
    rename: /@\w+/,
    grammar: /\w+/,
    or: exact("|"),
    literal: [stringLiteral(`"`), stringLiteral(`'`)],
  })
  .build();

/**
 * Definition to TempGrammarRules.
 */
export function defToTempGRs<T, Kinds extends string>(
  defs: Definition<Kinds>,
  ctx?: DefinitionContext<T, Kinds>
) {
  const result: TempGrammarRule<T, Kinds>[] = [];

  // parse rules
  for (const NT in defs) {
    /** `[grammar rule index][token index]` */
    const rules: ({ name: string } & ReturnType<typeof grammarLexer.lex>)[][] =
      [[]];
    const def = defs[NT];
    const defStr = def instanceof Array ? def.join("|") : (def as string);
    grammarLexer
      .reset()
      .lexAll(defStr)
      .forEach((t) => {
        if (t.kind == "or") rules.push([]); // new grammar rule
        else if (t.kind == "rename") {
          const token = rules.at(-1)?.at(-1);
          if (!token) throw LR_BuilderError.noRenameTarget(def!, t.content);
          token.name = t.content.slice(1); // remove `@`
        }
        // append token to the last grammar rule with name
        else rules.at(-1)!.push({ ...t, name: t.content }); // TODO: don't use t.content as the name for literal, use lexer to lex the name
      });

    if (grammarLexer.hasRest())
      throw LR_BuilderError.tokenizeGrammarRuleFailed(
        defStr,
        grammarLexer.getRest()
      );
    if (rules.length == 1 && rules[0].length == 0)
      throw LR_BuilderError.emptyRule(NT, defStr);

    rules.forEach((tokens) => {
      const ruleStr = tokens.map((t) => t.content).join(" ");

      if (tokens.length == 0) throw LR_BuilderError.emptyRule(NT, defStr);

      if (
        !tokens
          .filter((t) => t.kind == "literal")
          .every((t) => t.content.length > 2)
      )
        throw LR_BuilderError.emptyLiteral(NT, ruleStr);

      result.push(
        new TempGrammarRule<T, Kinds>({
          NT,
          rule: tokens.map((t) => {
            if (t.kind == "grammar")
              return new TempGrammar({
                type: TempGrammarType.GRAMMAR,
                content: t.content.split("@")[0],
                name: t.name,
              });
            else
              return new TempGrammar({
                type: TempGrammarType.LITERAL,
                content: t.content.slice(1, -1), // remove quotes
                name: t.name,
              });
          }),
          callback: ctx?.callback,
          rejecter: ctx?.rejecter,
          rollback: ctx?.rollback,
          commit: ctx?.commit,
          traverser: ctx?.traverser,
        })
      );
    });
  }
  return result;
}
