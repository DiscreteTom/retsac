import { Lexer, ELR } from "../../../src";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces())
  .define({
    number: /[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact("--")) // double character operators, will be lexed first
  .anonymous(Lexer.exact("-")) // single character operators, will be lexed second
  .build();

export let someState = 0;

export const parser = new ELR.ParserBuilder<number>()
  .useLexerKinds(lexer)
  .define(
    { exp: "number" },
    // reducer is called if the grammar rule is accepted
    // and the result will be set to the `data` field of the AST node
    ELR.reducer(({ matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `exp '--'` },
    ELR.reducer(({ values }) => values[0]! - 1), // e.g. `2--` is `2 - 1`
    ELR.callback(() => (someState = 1)), // callback will be called if the grammar rule is accepted
    ELR.rollback(() => (someState = 0)) // rollback will be called when re-lex
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer(({ values }) => -values[1]!)
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer(({ values }) => values[0]! - values[2]!)
  )
  .priority({ exp: `'-' exp` }, { exp: `exp '-' exp` }, { exp: `exp '--'` })
  .leftSA({ exp: `exp '-' exp` })
  .entry("exp")
  // IMPORTANT: set `rollback` to `true` to enable rollback functions
  // otherwise, rollback functions will not be called to improve performance
  .build(lexer, { checkAll: true, rollback: true });
