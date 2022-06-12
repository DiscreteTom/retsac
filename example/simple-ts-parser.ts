import { Lexer } from "../src/lexer/lexer";
import { exact, from_to, stringLiteral, wordType } from "../src/lexer/utils";
import * as fs from "fs";
import { ParserManager } from "../src/parser/manager";
import * as path from "path";
import { LRParserBuilder } from "../src/parser/LR/builder";

// process this file
const code = fs.readFileSync(
  path.join(__dirname, `/../../example/${path.basename(__filename, ".js")}.ts`),
  "utf-8"
);

const lexer = new Lexer()
  .ignore(
    /^\s/, // blank
    from_to("//", "\n", true), // single line comments
    from_to("/*", "*/", true) // multi-line comments
  )
  .define(
    wordType(
      "import",
      "from",
      "const",
      "true",
      "false",
      "if",
      "new",
      "as",
      "while",
      "break",
      "let"
    ) // keywords
  )
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
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
    exact("=>", "!=", "&&"), // two-char operator
    exact(..."{};,*=.()+:[]!?") // one-char operator
  );

let parser = new ParserManager(lexer).add(
  new LRParserBuilder()
    .define({ import_stmt: `import '*' as identifier from string ';'` })
    .define({ import_stmt: `import '{' multi_identifier '}' from string ';'` })
    .define({
      multi_identifier: `identifier | multi_identifier ',' identifier`,
    })
    .define({ const_stmt: `const identifier '=' exp ';'` })
    .define({ let_stmt: `let identifier '=' exp ';'` })
    .define({
      exp: `identifier | string | regex | true | false | object | array | break`,
    })
    .define({ exp: `new identifier` })
    .define({ exp: `'!' exp` })
    .define({ exp: `exp '.' identifier` })
    .define({ exp: `exp '?' '.' identifier` })
    .define({ exp: `exp '(' ')'` })
    .define({ exp: `exp '(' exps ')'` })
    .define({ exp: `exp '[' exp ']'` })
    .define({ exp: `'...' exp` })
    .define({ exp: `exp '!=' exp` })
    .define({ exp: `exp '&&' exp` })
    .define({ object: `'{' object_items '}'` })
    .define({
      object_items: `object_item | object_items ',' object_item | object_items ','`,
    })
    .define({ object_item: `identifier ':' exp` })
    .define({ array: `'[' exps ']'` })
    .define({ exps: `exp | exps ',' exp | exps ','` })
    .define({ if_stmt: `if '(' exp ')' exp_stmt` })
    .define({ if_stmt: `if '(' exp ')' '{' exp_stmts '}'` })
    .define({ exp_stmt: `exp ';'` })
    .define({ exp_stmts: `exp_stmt | exp_stmts exp_stmt` })
    .define({ while_stmt: `while '(' exp ')' exp_stmt` })
    .define({ while_stmt: `while '(' exp ')' '{' stmts '}'` })
    .define({ stmts: `stmt | stmts stmt` })
    .define({
      stmt: `exp_stmts | if_stmt | const_stmt | let_stmt | while_stmt`,
    })
    .entry(
      "import_stmt",
      "const_stmt",
      "exp_stmt",
      "if_stmt",
      "while_stmt",
      "let_stmt"
    )
    .checkSymbols(lexer.getTokenTypes())
    .build(true) // enable debug mode
);

parser.feed(code);

while (true) {
  // parse one statement
  if (!parser.parse().accept) break;
  let stmt = parser.take();
  console.log(stmt.toTreeString());
}

if (parser.getBuffer().length) {
  console.log("===========  Unreduced  ===========");
  console.log(parser.getBuffer());
}

if (lexer.hasRest()) {
  console.log(`===========  Undigested  ===========`);
  console.log(lexer.getRest());
}
