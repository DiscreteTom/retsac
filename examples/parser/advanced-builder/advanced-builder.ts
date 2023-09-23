import { readFileSync } from "fs";
import { ELR, Lexer } from "../../../src";

export const cache = (() => {
  try {
    return JSON.parse(
      readFileSync("./examples/parser/advanced-builder/dfa.json", "utf8"),
    );
  } catch {
    return undefined;
  }
})();

export const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank chars
  .define(Lexer.wordKind("pub", "fn", "return", "let")) // keywords
  .define({
    integer: /([1-9][0-9]*|0)/,
    identifier: /[a-zA-Z_]\w*/,
  })
  .anonymous(Lexer.exact(..."+-*/():{};=,")) // single char operator
  .build();

export const builder = new ELR.AdvancedBuilder()
  .define({
    // use `@` to rename a node
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
  .priority({ exp: `exp '+' exp` })
  .entry("fn_def");

export const { parser } = builder.build({
  lexer,
  // use the cached data to speed up
  // this is recommended in production
  hydrate: cache,
  // this should be set to `true` in development
  checkAll: true,
});
