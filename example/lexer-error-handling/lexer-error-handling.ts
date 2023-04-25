import { Lexer } from "../../src";
import { Action, stringLiteral } from "../../src/lexer";

/**
 * This example shows how to handle errors without stopping the parsing process.
 */

export const lexer = new Lexer.Builder()
  .define({
    // mark error when a string literal is not closed
    string: [
      // first, try to match a string literal with double quotes and no multiline
      stringLiteral(`"`),
      // if it fails, try to match a string literal starts with a double quote and ends with a new line
      stringLiteral(`"`, { close: "\n", multiline: true }).check(
        // mark this as an error
        () => "Unclosed string literal"
      ),
      // if it also fails, means the input string starts with a double quote but not ends with a new line
      // so the whole input is an unclosed string literal
      Action.from(/^".*$/).check(() => "Unclosed string literal"),
    ],

    // mark error when a number literal is too big
    number: Action.from(/^\d+/).check((s) =>
      // convert the matched string to a number and check if it is greater than 65535
      Number(s) > 65535 ? "Number is too big" : undefined
    ),
  })
  .build();
