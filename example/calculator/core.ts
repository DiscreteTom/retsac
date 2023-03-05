import { Lexer, ELR } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

export const parser = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer(({ matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer<number>(({ values }) => -values[1]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: true })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: true })
  )
  .define(
    { exp: `'(' exp ')'` },
    ELR.reducer(({ values }) => values[1])
  )
  .define(
    { exp: `exp '+' exp` },
    ELR.reducer<number>(({ values }) => values[0]! + values[2]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: false })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: false })
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer<number>(({ values }) => values[0]! - values[2]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: false })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: false })
  )
  .define(
    { exp: `exp '*' exp` },
    ELR.reducer<number>(({ values }) => values[0]! * values[2]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: true })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: true })
  )
  .define(
    { exp: `exp '/' exp` },
    ELR.reducer<number>(({ values }) => values[0]! / values[2]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: true })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: true })
  )
  .build(lexer, { checkAll: true });
