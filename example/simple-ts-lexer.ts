import { Lexer } from "../src/lexer/lexer";
import { exact, from_to, stringLiteral, word } from "../src/lexer/utils";
import * as fs from "fs";

// lex this file
const code = fs.readFileSync(
  __dirname + "/../../example/simple-ts-lexer.ts",
  "utf-8"
);

const lexer = new Lexer()
  .ignore(
    /^\s/, // blank
    from_to("//", "\n", true), // single line comments
    from_to("/*", "*/", true) // multi-line comments
  )
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
    keyword: word(
      "import",
      "from",
      "const",
      "true",
      "false",
      "if",
      "new",
      "as"
    ),
    identifier: /^\w+/,
    regex: from_to("/", "/", false),
  })
  .overload({
    string: [
      stringLiteral({ double: true, single: true }),
      stringLiteral({ back: true, multiline: true }),
    ],
  })
  .anonymous(
    exact("..."), // 3-char operator
    exact("=>"), // two-char operator
    exact(..."{};,*=.()+:[]") // one-char operator
  );

lexer.lexAll(code).map((token) => {
  console.log({
    type: token.type,
    content: token.content,
    start: lexer.getPos(token.start),
  });
});

if (lexer.hasRest()) console.log(`Undigested: \n${lexer.getRest()}`);
