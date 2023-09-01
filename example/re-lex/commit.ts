import { Lexer, ELR } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces())
  .define({
    number: /[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact("--")) // double character operators, will be lexed first
  .anonymous(Lexer.exact("-")) // single character operators, will be lexed second
  .build();

export const parser_1 = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer(({ matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `exp '--'` },
    ELR.reducer<number>(({ values }) => values[0]! - 1) // e.g. `2--` is `2 - 1`
      .commit()
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer<number>(({ values }) => -values[1]!)
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer<number>(({ values }) => values[0]! - values[2]!)
  )
  .priority({ exp: `'-' exp` }, { exp: `exp '-' exp` }, { exp: `exp '--'` })
  .leftSA({ exp: `exp '-' exp` })
  .build(lexer.clone(), { checkAll: true });

export const parser_2 = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer(({ matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `exp '--'` },
    ELR.reducer<number>(({ values }) => values[0]! - 1) // e.g. `2--` is `2 - 1`
      .commit(() => true) // use a function to decide whether to commit
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer<number>(({ values }) => -values[1]!)
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer<number>(({ values }) => values[0]! - values[2]!)
  )
  .priority({ exp: `'-' exp` }, { exp: `exp '-' exp` }, { exp: `exp '--'` })
  .leftSA({ exp: `exp '-' exp` })
  .build(lexer, { checkAll: true });
