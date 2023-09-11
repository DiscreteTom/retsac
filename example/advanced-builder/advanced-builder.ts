import { readFileSync } from "fs";
import { ELR, Lexer } from "../../src";
import { SerializableParserData } from "../../src/parser/ELR";

const cache = (() => {
  try {
    return JSON.parse(
      readFileSync("./example/advanced-builder/dfa.json", "utf8")
    ) as SerializableParserData;
  } catch {
    return undefined;
  }
})();

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank chars
  .define(Lexer.wordKind("pub", "fn", "return", "let")) // keywords
  .define({
    integer: /([1-9][0-9]*|0)/,
    identifier: /[a-zA-Z_]\w*/,
  })
  .anonymous(Lexer.exact(..."+-*/():{};=,")) // single char operator
  .build();

const builder = new ELR.AdvancedBuilder()
  .useLexerKinds(lexer)
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
  .leftSA({ exp: `exp '+' exp` })
  .entry("fn_def");

export const parser = builder.build(lexer, {
  // use the cached data to speed up
  // this is recommended in production
  hydrate: cache,
  // serialize the data for future use in `hydrate`
  // this is should be done before production
  serialize: true,
  // this should be set to `true` in development
  checkAll: true,
});

// since the `serialize` option is set to `true`,
// we can get the serializable data from the builder
export const serializable = builder.serializable;
