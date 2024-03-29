import { Lexer } from "../../../src";

/**
 * This example shows how to handle errors without stopping the lexing process.
 */

export const lexer = new Lexer.Builder()
  .error<string>() // set error type
  .define({
    // built-in utils will check common errors and flag it in output.data
    // you can set error by checking output.data
    string: Lexer.stringLiteral(`"`).check(({ output }) =>
      output.data.unclosed ? "unclosed string literal" : undefined,
    ),
    number: Lexer.javascript
      .numericLiteral()
      .check(({ output }) =>
        output.data.invalid ? "invalid numeric literal" : undefined,
      ),
    // you can customize your own error handling function using `check`
    identifier: (a) =>
      a
        .from(/\w+/)
        .check(({ output }) =>
          output.content.match(/\d/)
            ? "identifier should not starts with a number"
            : undefined,
        ),
  })
  // if you are **not working with parser**, you can define a fallback rule
  // to accept one character at a time.
  // when you are working with parser, lexer's rejection is an important signal
  // for the parser, so we shouldn't define a fallback rule.
  .ignore(
    Lexer.Action.from(/./),
    // print some logs
    // .then(({ content }) => console.log(`eat "${content}" as a fallback`)),
  )
  .build();

// if the lexing process is stopped, you can also use `take` and `takeUntil`
// to eat the input manually.
// lexer.take(10) // eat 10 characters
// lexer.takeUntil(/}/) // eat until `}`
