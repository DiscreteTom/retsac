import { Lexer } from "../../../src";
import { Action, numericLiteral, stringLiteral } from "../../../src/lexer";

/**
 * This example shows how to handle errors without stopping the parsing process.
 */

export const lexer = new Lexer.Builder()
  .define({
    // built-in utils will check unclosed strings and invalid numbers
    // and accept the input with error
    string: stringLiteral(`"`),
    number: numericLiteral(),
    // you can customize your own error handling function using `check`
    identifier: Action.from(/\w+/).check(({ content }) =>
      content.match(/\d/)
        ? "identifier should not starts with a number"
        : undefined
    ),
  })
  // if you are **not working with parser**, you can define a fallback rule
  // to accept one character at a time
  .ignore(/./)
  .build();

// TODO: take & takeUntil
