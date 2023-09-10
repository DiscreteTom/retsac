import { ELR, Lexer } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank chars
  .define(Lexer.wordKind("pub", "fn")) // keywords
  .define({
    identifier: /[a-zA-Z_]\w*/,
  })
  .anonymous(Lexer.exact(..."+-*/():{};=")) // single char operator
  .build();

export let fName = "";
export let returnType = "";

export const parser = new ELR.ParserBuilder()
  .useLexerKinds(lexer)
  .entry("fn_def")
  .define(
    {
      fn_def: `
        pub fn identifier '(' ')' ':' identifier '{'
        '}'
      `,
    },
    ELR.callback(({ $$ }) => {
      fName = $$("identifier")[0].text!;
      returnType = $$("identifier")[1].text!;
    })
  )
  .build(lexer);
