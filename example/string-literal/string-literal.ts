import { Lexer } from "../../src";

export const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces)
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
