import { Lexer, ELR } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact("--")) // double character operators, will be lexed first
  .anonymous(Lexer.exact("-")) // single character operators, will be lexed second
  .build();

export const parser_1 = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `exp '--'` },
    ELR.reducer<number>((values) => values[0]! - 1) // e.g. `2--` is `2 - 1`
      .commit()
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer<number>((values) => -values[1]!)
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer<number>((values) => values[0]! - values[2]!)
  )
  .resolveRS(
    { exp: `'-' exp` },
    { exp: `exp '--'` },
    { next: `'--'`, reduce: true }
  )
  .resolveRS(
    { exp: `'-' exp` },
    { exp: `exp '-' exp` },
    { next: `'-'`, reduce: true }
  )
  .resolveRS(
    { exp: `exp '-' exp` },
    { exp: `exp '--'` },
    { next: `'--'`, reduce: true }
  )
  .resolveRS(
    { exp: `exp '-' exp` },
    { exp: `exp '-' exp` },
    { next: `'-'`, reduce: true }
  )
  // .generateResolvers(lexer);
  .checkAll(lexer.getTokenTypes(), lexer.dryClone())
  .build(lexer.clone());

export const parser_2 = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `exp '--'` },
    ELR.reducer<number>((values) => values[0]! - 1) // e.g. `2--` is `2 - 1`
      .commit(() => true) // use a function to decide whether to commit
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer<number>((values) => -values[1]!)
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer<number>((values) => values[0]! - values[2]!)
  )
  .resolveRS(
    { exp: `'-' exp` },
    { exp: `exp '--'` },
    { next: `'--'`, reduce: true }
  )
  .resolveRS(
    { exp: `'-' exp` },
    { exp: `exp '-' exp` },
    { next: `'-'`, reduce: true }
  )
  .resolveRS(
    { exp: `exp '-' exp` },
    { exp: `exp '--'` },
    { next: `'--'`, reduce: true }
  )
  .resolveRS(
    { exp: `exp '-' exp` },
    { exp: `exp '-' exp` },
    { next: `'-'`, reduce: true }
  )
  // .generateResolvers(lexer);
  .checkAll(lexer.getTokenTypes(), lexer)
  .build(lexer);
