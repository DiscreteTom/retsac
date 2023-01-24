import { Lexer, ELR } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact("--")) // double character operators, will be lexed first
  .anonymous(Lexer.exact("-")) // single character operators, will be lexed second
  .build();

export let someState = 0;

export const parser = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `exp '--'` },
    ELR.reducer<number>((values) => values[0]! - 1) // e.g. `2--` is `2 - 1`
      .callback(() => (someState = 1)) // callback will be called if the grammar rule is accepted
      .rollback(() => (someState = 0)) // rollback will be called when re-lex
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
