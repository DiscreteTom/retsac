import { Lexer, ELR } from "../../src";
import * as fs from "fs";

// To run this file, you can use `ts-node`: `ts-node examples/parser/simple-ts-parser.ts`.
// The output is very long, so you can redirect it to a file: `ts-node examples/parser/simple-ts-parser.ts > output.txt`

// if you want to run this file using node instead of ts-node, you can use the following code to read the code from the file
// import * as path from "path";
// const code = fs.readFileSync(
//   path.join(__dirname, `/../../examples/parser/${path.basename(__filename, ".js")}.ts`),
//   "utf-8"
// );

// process this file
const code = fs.readFileSync(__filename, "utf-8");

const lexer = new Lexer.Builder()
  .ignore(
    Lexer.whitespaces(), // blank
    Lexer.comment("//"), // single line comment
    Lexer.comment("/*", "*/") // multiline comment
  )
  .define(
    Lexer.wordKind(
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
    identifier: /\w+/,
    number: Lexer.numericLiteral(),
    regex: Lexer.regexLiteral(),
    string: [
      Lexer.stringLiteral(`"`),
      Lexer.stringLiteral(`'`),
      Lexer.stringLiteral("`", { multiline: true }),
    ],
  })
  .anonymous(
    Lexer.exact("..."), // 3-char operator
    Lexer.exact("=>", "!=", "&&"), // two-char operator
    Lexer.exact(..."{};,*=.()+:[]!?") // one-char operator
  )
  .build();

const parser = new ELR.AdvancedBuilder()
  .useLexerKinds(lexer)
  .define({ import_stmt: `import '*' as identifier from string ';'` })
  .define({
    import_stmt: `import '{' identifier (',' identifier)* '}' from string ';'`,
  })
  .define({ const_stmt: `const identifier '=' exp ';'` })
  .define({ let_stmt: `let identifier '=' exp ';'` })
  .define({
    exp: `identifier | string | regex | true | false | object | array | break`,
  })
  .define({ exp: `new identifier` })
  .define({ exp: `'!' exp` })
  .define({ exp: `exp '?'? '.' identifier` })
  .define({ exp: `exp '(' (exp (',' exp)*)? ')'` })
  .define({ exp: `exp '[' exp ']'` })
  .define({ exp: `'...' exp` })
  .define({ exp: `exp '!=' exp` })
  .define({ exp: `exp '&&' exp` })
  .define({ object: `'{' (object_item (',' object_item)*)? '}'` })
  .define({ object_item: `identifier` })
  .define({ object_item: `identifier ':' exp` })
  .define({ array: `'[' (exp (',' exp)*)? ']'` })
  .define({ block_stmt: `'{' stmts '}'` })
  .define({ if_stmt: `if '(' exp ')' stmt` })
  .define({ exp_stmt: `exp ';'` })
  .define({ while_stmt: `while '(' exp ')' stmt` })
  .define({ stmts: `stmt | stmts stmt` })
  .define({
    stmt: `exp_stmt+ | if_stmt | const_stmt | let_stmt | while_stmt | block_stmt`,
  })
  .entry(
    "import_stmt",
    "const_stmt",
    "exp_stmt",
    "if_stmt",
    "while_stmt",
    "let_stmt"
  )
  .priority(
    [
      { exp: `exp '?'? '.' identifier` },
      { exp: `exp '(' (exp (',' exp)*)? ')'` },
      { exp: `exp '[' exp ']'` },
    ],
    [{ exp: `'!' exp` }, { exp: `'...' exp` }],
    [{ exp: `exp '!=' exp` }, { exp: `exp '&&' exp` }],
    { exp_stmt: `exp ';'` }
  )
  .resolveRR(
    { exp: `identifier` },
    { object_item: `identifier` },
    { next: `'}' ','`, accept: true }
  )
  .resolveRR(
    { object_item: `identifier` },
    { exp: `identifier` },
    { next: `'}' ','`, accept: true }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '.' identifier` },
    { next: `'.'`, accept: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '?' '.' identifier` },
    { next: `'?'`, accept: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '(' ')'` },
    { next: `'('`, accept: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '(' exps ')'` },
    { next: `'('`, accept: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '[' exp ']'` },
    { next: `'['`, accept: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '!=' exp` },
    { next: `'!='`, accept: false }
  )
  .resolveRS(
    { object_item: `identifier ':' exp` },
    { exp: `exp '&&' exp` },
    { next: `'&&'`, accept: false }
  )
  .resolveRR(
    { exp: `identifier` },
    { object_item: `identifier` },
    { next: `';' '.' '?' '(' '[' ']' '!=' '&&' ')'`, accept: true }
  )
  .resolveRR(
    { object_item: `identifier` },
    { exp: `identifier` },
    { next: `';' '.' '?' '(' '[' ']' '!=' '&&' ')'`, accept: false }
  )
  .build(lexer, { debug: true, checkAll: true }); // enable debug mode

parser.feed(code);

while (true) {
  // parse one statement
  if (!parser.parse().accept) break;
  const stmt = parser.take()[0];
  console.log(stmt?.toTreeString());
}

if (parser.buffer.length) {
  console.log("===========  Unreduced  ===========");
  console.log(parser.buffer);
}

if (parser.lexer.hasRest()) {
  console.log(`===========  Undigested  ===========`);
  console.log(parser.lexer.getRest());
}
