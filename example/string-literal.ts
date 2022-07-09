import { Lexer } from "../src";

export let lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    simpleStr: Lexer.stringLiteral({
      single: true,
      double: true,
    }),
    multilineStr: Lexer.stringLiteral({ back: true, multiline: true }),
    customQuote: Lexer.stringLiteral({ quote: "*" }),
    custom: Lexer.stringLiteral({ from: "^", to: "$$" }),
  })
  .build();
