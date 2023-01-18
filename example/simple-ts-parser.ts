import { Lexer, ELR } from "../src";
import * as fs from "fs";

// To run this file, you can use `ts-node`: `ts-node example/simple-ts-parser.ts`.
// The output is very long, so you can redirect it to a file: `ts-node example/simple-ts-parser.ts > output.txt`

// if you want to run this file using node instead of ts-node, you can use the following code to read the code from the file
// import * as path from "path";
// const code = fs.readFileSync(
//   path.join(__dirname, `/../../example/${path.basename(__filename, ".js")}.ts`),
//   "utf-8"
// );

// process this file
const code = fs.readFileSync(__filename, "utf-8");

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
    ) // keywords, not all typescript keywords are supported for simplicity
  )
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
    identifier: /^\w+/,
    regex: Lexer.from_to("/", "/", false), // for simplicity, we don't support complex regex
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

const parser = new ELR.ParserBuilder()
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
  .define({ block_stmt: `'{' stmts '}'` })
  .define({ if_stmt: `if '(' exp ')' stmt` })
  .define({ exp_stmt: `exp ';'` })
  .define({ exp_stmts: `exp_stmt | exp_stmts exp_stmt` })
  .define({ while_stmt: `while '(' exp ')' stmt` })
  .define({ stmts: `stmt | stmts stmt` })
  .define({
    stmt: `exp_stmts | if_stmt | const_stmt | let_stmt | while_stmt | block_stmt`,
  })
  .entry(
    "import_stmt",
    "const_stmt",
    "exp_stmt",
    "if_stmt",
    "while_stmt",
    "let_stmt"
  )
  .resolveRS(
    { exp: `'!' exp` },
    { exp: `exp '.' identifier` },
    { next: `'.'`, reduce: false }
  )
  .resolveRS(
    { exp: `'!' exp` },
    { exp: `exp '?' '.' identifier` },
    { next: `'?'`, reduce: false }
  )
  .resolveRS(
    { exp: `'!' exp` },
    { exp: `exp '(' ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exp: `'!' exp` },
    { exp: `exp '(' exps ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exp: `'!' exp` },
    { exp: `exp '[' exp ']'` },
    { next: `'['`, reduce: false }
  )
  .resolveRS(
    { exp: `'!' exp` },
    { exp: `exp '!=' exp` },
    { next: `'!='`, reduce: true }
  )
  .resolveRS(
    { exp: `'!' exp` },
    { exp: `exp '&&' exp` },
    { next: `'&&'`, reduce: true }
  )
  .resolveRS(
    { exp: `'...' exp` },
    { exp: `exp '.' identifier` },
    { next: `'.'`, reduce: false }
  )
  .resolveRS(
    { exp: `'...' exp` },
    { exp: `exp '?' '.' identifier` },
    { next: `'?'`, reduce: false }
  )
  .resolveRS(
    { exp: `'...' exp` },
    { exp: `exp '(' ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exp: `'...' exp` },
    { exp: `exp '(' exps ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exp: `'...' exp` },
    { exp: `exp '[' exp ']'` },
    { next: `'['`, reduce: false }
  )
  .resolveRS(
    { exp: `'...' exp` },
    { exp: `exp '!=' exp` },
    { next: `'!='`, reduce: true }
  )
  .resolveRS(
    { exp: `'...' exp` },
    { exp: `exp '&&' exp` },
    { next: `'&&'`, reduce: true }
  )
  .resolveRS(
    { exp: `exp '!=' exp` },
    { exp: `exp '.' identifier` },
    { next: `'.'`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '!=' exp` },
    { exp: `exp '?' '.' identifier` },
    { next: `'?'`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '!=' exp` },
    { exp: `exp '(' ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '!=' exp` },
    { exp: `exp '(' exps ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '!=' exp` },
    { exp: `exp '[' exp ']'` },
    { next: `'['`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '!=' exp` },
    { exp: `exp '!=' exp` },
    { next: `'!='`, reduce: true }
  )
  .resolveRS(
    { exp: `exp '!=' exp` },
    { exp: `exp '&&' exp` },
    { next: `'&&'`, reduce: true }
  )
  .resolveRS(
    { exp: `exp '&&' exp` },
    { exp: `exp '.' identifier` },
    { next: `'.'`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '&&' exp` },
    { exp: `exp '?' '.' identifier` },
    { next: `'?'`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '&&' exp` },
    { exp: `exp '(' ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '&&' exp` },
    { exp: `exp '(' exps ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '&&' exp` },
    { exp: `exp '[' exp ']'` },
    { next: `'['`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '&&' exp` },
    { exp: `exp '!=' exp` },
    { next: `'!='`, reduce: false }
  )
  .resolveRS(
    { exp: `exp '&&' exp` },
    { exp: `exp '&&' exp` },
    { next: `'&&'`, reduce: true }
  )
  .resolveRS(
    { stmt: `exp_stmts` },
    { exp_stmts: `exp_stmts exp_stmt` },
    {
      next: `'{' exp identifier string regex true false object array break new '!' '...' '['`,
      reduce: true,
    }
  )
  .resolveRR(
    { exp: `identifier` },
    { object_item: `identifier` },
    { next: `'}' ','`, reduce: true }
  )
  .resolveRR(
    { object_item: `identifier` },
    { exp: `identifier` },
    { next: `'}' ','`, reduce: true }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '.' identifier` },
    { next: `'.'`, reduce: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '?' '.' identifier` },
    { next: `'?'`, reduce: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '(' ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '(' exps ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '[' exp ']'` },
    { next: `'['`, reduce: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '!=' exp` },
    { next: `'!='`, reduce: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '&&' exp` },
    { next: `'&&'`, reduce: false }
  )
  .resolveRS(
    { exps: `exp` },
    { exp: `exp '.' identifier` },
    { next: `'.'`, reduce: false }
  )
  .resolveRS(
    { exps: `exp` },
    { exp: `exp '?' '.' identifier` },
    { next: `'?'`, reduce: false }
  )
  .resolveRS(
    { exps: `exp` },
    { exp: `exp '(' ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exps: `exp` },
    { exp: `exp '(' exps ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exps: `exp` },
    { exp: `exp '[' exp ']'` },
    { next: `'['`, reduce: false }
  )
  .resolveRS(
    { exps: `exp` },
    { exp: `exp '!=' exp` },
    { next: `'!='`, reduce: false }
  )
  .resolveRS(
    { exps: `exp` },
    { exp: `exp '&&' exp` },
    { next: `'&&'`, reduce: false }
  )
  .resolveRS(
    { exps: `exps ',' exp` },
    { exp: `exp '.' identifier` },
    { next: `'.'`, reduce: false }
  )
  .resolveRS(
    { exps: `exps ',' exp` },
    { exp: `exp '?' '.' identifier` },
    { next: `'?'`, reduce: false }
  )
  .resolveRS(
    { exps: `exps ',' exp` },
    { exp: `exp '(' ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exps: `exps ',' exp` },
    { exp: `exp '(' exps ')'` },
    { next: `'('`, reduce: false }
  )
  .resolveRS(
    { exps: `exps ',' exp` },
    { exp: `exp '[' exp ']'` },
    { next: `'['`, reduce: false }
  )
  .resolveRS(
    { exps: `exps ',' exp` },
    { exp: `exp '!=' exp` },
    { next: `'!='`, reduce: false }
  )
  .resolveRS(
    { exps: `exps ',' exp` },
    { exp: `exp '&&' exp` },
    { next: `'&&'`, reduce: false }
  )
  .resolveRS(
    { exps: `exps ','` },
    { exps: `exps ',' exp` },
    { next: `'['`, reduce: false }
  )
  .resolveRR(
    { exp: `identifier` },
    { object_item: `identifier` },
    { next: `';' '.' '?' '(' '[' ']' '!=' '&&' ')'`, reduce: true }
  )
  .resolveRR(
    { object_item: `identifier` },
    { exp: `identifier` },
    { next: `';' '.' '?' '(' '[' ']' '!=' '&&' ')'`, reduce: false }
  )
  // .generateResolvers(lexer);
  .checkAll(lexer.getTokenTypes(), lexer)
  .build(lexer, true); // enable debug mode

parser.feed(code);

while (true) {
  // parse one statement
  if (!parser.parse().accept) break;
  const stmt = parser.take();
  console.log(stmt?.toTreeString({ textQuote: '"' }));
}

if (parser.getNodes().length) {
  console.log("===========  Unreduced  ===========");
  console.log(parser.getNodes());
}

if (parser.lexer.hasRest()) {
  console.log(`===========  Undigested  ===========`);
  console.log(parser.lexer.getRest());
}
