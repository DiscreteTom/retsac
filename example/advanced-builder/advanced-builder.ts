import { AdvancedBuilder, ELR } from "../../src/parser";
import { Lexer } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(/^\s/) // ignore blank chars
  .define(Lexer.wordType("pub", "fn", "return", "let")) // keywords
  .define({
    integer: /^([1-9][0-9]*|0)/,
    identifier: /^[a-zA-Z_]\w*/,
  })
  .anonymous(Lexer.exact("&&", "||", "++", "--")) // double char operator
  .anonymous(Lexer.exact(..."+-*/():{};=,")) // single char operator
  .build();

export const parser = new AdvancedBuilder({ prefix: `__generated_` })
  .define({
    fn_def: `
      pub fn identifier '(' (param (',' param)*)? ')' ':' identifier '{'
        stmt*
      '}'
    `,
  })
  .define({ param: `identifier ':' identifier` })
  .define({ stmt: `assign_stmt | ret_stmt` })
  .define({ assign_stmt: `let identifier ':' identifier '=' exp ';'` })
  .define({ ret_stmt: `return exp ';'` })
  .define({ exp: `integer` })
  .define({ exp: `identifier` })
  .define({ exp: `exp '+' exp` })
  .expand()
  .entry("fn_def")
  .resolveRS(
    { exp: `exp '+' exp` },
    { exp: `exp '+' exp` },
    { next: `'+'`, reduce: true }
  )
  .generateResolvers(lexer)
  .checkAll(lexer.getTokenTypes(), lexer)
  .build(lexer);
