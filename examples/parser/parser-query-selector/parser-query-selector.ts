import { ELR, Lexer } from "../../../src";

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

export const { parser } = new ELR.ParserBuilder()
  .define(
    {
      fn_def: `
        pub fn identifier '(' ')' ':' identifier '{'
        '}'
      `,
    },
    // callback will be called if the rule is accepted
    ELR.callback(({ $, $$ }) => {
      // use `$` to get the first matched token
      fName = $("identifier")!.text!;
      // use `$$` to get all matched tokens
      returnType = $$("identifier")[1].text!;
    }),
  )
  .entry("fn_def")
  .build(lexer);
