import { Lexer, Manager, LR } from "../src";
import * as fs from "fs";
import * as path from "path";

// process this file
const code = fs.readFileSync(
  path.join(__dirname, `/../../example/${path.basename(__filename, ".js")}.ts`),
  "utf-8"
);

const lexer = new Lexer.Builder()
  .ignore(
    /^\s/, // blank
    Lexer.from_to("//", "\n", true), // single line comments
    Lexer.from_to("/*", "*/", true) // multi-line comments
  )
  .define(
    Lexer.wordType(
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
    regex: Lexer.from_to("/", "/", false),
    string: [
      Lexer.stringLiteral({ double: true, single: true }),
      Lexer.stringLiteral({ back: true, multiline: true }),
    ],
  })
  .anonymous(
    Lexer.exact("..."), // 3-char operator
    Lexer.exact("=>", "!=", "&&"), // two-char operator
    Lexer.exact(..."{};,*=.()+:[]!?") // one-char operator
  )
  .build();

let parser = new LR.ParserBuilder()
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
  .define({ object_item: `identifier` })
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
  .build(true); // enable debug mode

let manager = new Manager({
  lexer,
  parser,
});

manager.feed(code);

while (true) {
  // parse one statement
  if (!manager.parse().accept) break;
  let stmt = manager.take();
  console.log(stmt?.toTreeString({ textQuote: '"' }));
}

if (manager.getBuffer().length) {
  console.log("===========  Unreduced  ===========");
  console.log(manager.getBuffer());
}

if (lexer.hasRest()) {
  console.log(`===========  Undigested  ===========`);
  console.log(lexer.getRest());
}
