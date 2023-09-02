import { ELR, Lexer } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank chars
  .define(Lexer.wordKind("pub", "fn", "return", "let")) // keywords
  .define({
    integer: /([1-9][0-9]*|0)/,
    identifier: /[a-zA-Z_]\w*/,
  })
  .anonymous(Lexer.exact(..."+-*/():{};=,")) // single char operator
  .build();

export const parser = new ELR.AdvancedBuilder()
  .define({
    // use `@` to rename a node, this is effective only when using `$` to query nodes
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
  .entry("fn_def")
  .leftSA({ exp: `exp '+' exp` })
  .build(lexer, { generateResolvers: "builder", checkAll: true });
