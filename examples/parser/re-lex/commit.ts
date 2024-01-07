import { Lexer, ELR } from "../../../src";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces())
  .define({ num: Lexer.javascript.numericLiteral() })
  .anonymous(...Lexer.exactArray("-", "--"))
  .build();

export const { parser } = new ELR.AdvancedBuilder({ lexer })
  .define(
    // the first rule will be tried first
    { exp: `num '-'` },
    (d) => d.commit(), // once commit, re-lex won't overwrite the result
  )
  .define({ exp: `exp '-'` })
  .define({ exp: `num '--' num` })
  .build({
    entry: "exp",
    checkAll: true,
    // debug: true,
  });
