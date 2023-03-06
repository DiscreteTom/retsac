import { ELR, Lexer } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(/^\s/) // ignore blank chars
  .define(Lexer.wordType("pub", "fn", "return", "let")) // keywords
  .define({
    integer: /^([1-9][0-9]*|0)/,
    identifier: /^[a-zA-Z_]\w*/,
  })
  .anonymous(Lexer.exact(..."+-*/():{};=,")) // single char operator
  .build();

export const parser = new ELR.AdvancedBuilder()
  .define({
    fn_def: `
      pub fn identifier@funcName '(' (param (',' param)*)? ')' ':' identifier@retType '{'
        stmt*
      '}'
    `,
  })
  .define({ param: `identifier ':' identifier` })
  .define({ stmt: `assign_stmt | ret_stmt` }, ELR.commit()) // commit to prevent re-lex, optimize performance
  .define({ assign_stmt: `let identifier ':' identifier '=' exp ';'` })
  .define({ ret_stmt: `return exp ';'` })
  .define({ exp: `integer | identifier` })
  .define({ exp: `exp '+' exp` })
  .expand() // return a normal ELR.ParserBuilder
  .entry("fn_def")
  .resolveRS(
    { exp: `exp '+' exp` },
    { exp: `exp '+' exp` },
    { next: `'+'`, reduce: true }
  )
  .build(lexer, { generateResolvers: "builder", checkAll: true });
