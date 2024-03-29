import * as Lexer from "../../../../lexer";
import type { GeneralTokenDataBinding } from "../../../../lexer";
import {
  EmptyLiteralError,
  EmptyRuleError,
  NoRenameTargetError,
  TokenizeGrammarRuleFailedError,
} from "../error";
import type { Definition, DefinitionContext } from "../model";
import { TempGrammar, TempGrammarRule, TempGrammarType } from "../model";

const ruleLexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces())
  .define({
    rename: /@\w+/,
    grammar: /\w+/,
    or: Lexer.exact("|"),
    literal: [Lexer.stringLiteral(`"`), Lexer.stringLiteral(`'`)],
  })
  .build();

/**
 * Definition to TempGrammarRules.
 */
export function defToTempGRs<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  defs: Definition<NTs>,
  hydrationId: number = 0,
  ctx?: DefinitionContext<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
) {
  const result: TempGrammarRule<
    NTs,
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >[] = [];

  // parse rules
  for (const NT in defs) {
    /** `[grammar rule index][token index]` */
    const rules = [[]] as ({
      name?: string;
    } & ReturnType<typeof ruleLexer.lex>)[][];
    const def = defs[NT];
    const defStr = def instanceof Array ? def.join("|") : (def as string);
    ruleLexer
      .reset()
      .lexAll(defStr)
      .forEach((t) => {
        if (t.kind === "or") rules.push([]); // new grammar rule
        else if (t.kind === "rename") {
          const token = rules.at(-1)?.at(-1);
          if (!token) throw new NoRenameTargetError(def!, t.content);
          token.name = t.content.slice(1); // remove `@`
        }
        // append token to the last grammar rule without name
        else rules.at(-1)!.push(t);
      });

    if (ruleLexer.hasRest())
      throw new TokenizeGrammarRuleFailedError(defStr, ruleLexer.getRest());
    if (rules.length === 1 && rules[0].length === 0)
      throw new EmptyRuleError(NT);

    rules.forEach((tokens) => {
      const ruleStr = tokens.map((t) => t.content).join(" ");

      if (tokens.length === 0) throw new EmptyRuleError(NT);

      if (
        !tokens
          .filter((t) => t.kind === "literal")
          .every((t) => t.content.length > 2)
      )
        throw new EmptyLiteralError(NT, ruleStr);

      result.push(
        new TempGrammarRule<
          NTs,
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >({
          NT,
          rule: tokens.map((t) => {
            if (t.kind === "grammar")
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
          hydrationId,
        }),
      );
    });
  }
  return result;
}
