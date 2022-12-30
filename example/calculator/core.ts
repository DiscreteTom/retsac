import { Lexer, LR, Manager } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

const parser = new LR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    LR.reducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `'-' exp` },
    LR.reducer<number>((values) => -values[1])
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'` })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'` })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'` })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'` })
  )
  .define(
    { exp: `'(' exp ')'` },
    LR.reducer((values) => values[1])
  )
  .define(
    { exp: `exp '+' exp` },
    LR.reducer<number>((values) => values[0] + values[2])
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'` })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reject: true })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reject: true })
  )
  .define(
    { exp: `exp '-' exp` },
    LR.reducer<number>((values) => values[0] - values[2])
      .resolveRR(
        { exp: `'-' exp` },
        { handleEnd: true, next: `')' '+' '-' '*' '/'` }
      )
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'` })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reject: true })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reject: true })
  )
  .define(
    { exp: `exp '*' exp` },
    LR.reducer<number>((values) => values[0] * values[2])
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'` })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'` })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'` })
  )
  .define(
    { exp: `exp '/' exp` },
    LR.reducer<number>((values) => values[0] / values[2])
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'` })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'` })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'` })
  )
  .checkAll(lexer.getTokenTypes(), true)
  .build();

export const manager = new Manager({ lexer, parser });
