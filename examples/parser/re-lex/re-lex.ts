import { Lexer, ELR } from "../../../src";

export const result = {
  value: 0,
};

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces())
  .define({ num: Lexer.javascript.numericLiteral() })
  .anonymous(...Lexer.exactArray("-", "--"))
  .build();

export const { parser } = new ELR.AdvancedBuilder()
  .define(
    // the first rule will be tried first
    { exp: `num '-'` },
    (d) =>
      d
        .callback(() => (result.value = 1)) // callback will be called if the grammar rule is accepted
        .rollback(() => (result.value = 0)), // rollback will be called when re-lex
  )
  .define({ exp: `exp '-'` })
  .define({ exp: `num '--' num` })
  // IMPORTANT: set `rollback` to `true` to enable rollback functions
  // otherwise, rollback functions will not be called to improve performance
  .build({
    lexer,
    entry: "exp",
    checkAll: true,
    rollback: true,
  });
