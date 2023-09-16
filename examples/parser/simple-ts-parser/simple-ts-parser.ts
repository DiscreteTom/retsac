import { Lexer, ELR } from "../../../src";

// Usage: ts-node examples/parser/simple-ts-parser/simple-ts-parser.ts

export const lexer = new Lexer.Builder()
  .ignore(
    Lexer.whitespaces(), // blank
    Lexer.comment("//"), // single line comment
    Lexer.comment("/*", "*/"), // multiline comment
  )
  .define(
    // keywords, not all typescript keywords are supported for simplicity
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
      "let",
    ),
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
    Lexer.exact("..."), // 3-char operator (actually this is not an operator in TS)
    Lexer.exact("=>", "!=", "&&"), // two-char operator
    Lexer.exact(..."{};,*=.()+:[]!?"), // one-char operator and other symbols
  )
  .build();

export const builder = new ELR.AdvancedBuilder()
  // expressions, every expression has a value
  .define({ exps: `exp (',' exp)*` })
  .define({
    exp: `identifier | string | regex | true | false | object | array`, // primary expression
  })
  .define({ exp: `new identifier '(' exps? ')'` }) // new expression
  .define({ exp: [`'!' exp`, `'...' exp`] }) // unary expression
  .define({ exp: `exp '?'? '.' identifier` }) // member expression
  .define({ exp: `exp '(' exps? ')'` }) // call expression
  .define({ exp: `exp '[' exp ']'` }) // index expression
  .define({ exp: [`exp '!=' exp`, `exp '&&' exp`] }) // conditional expression
  // object & array
  .define({ object: `'{' (object_entry (',' object_entry)*)? '}'` })
  .define({ object_entry: `identifier (':' exp)?` })
  .define({ array: `'[' exps? ']'` })
  // statements
  .define({ exp_stmt: `exp ';'` })
  .define({ if_stmt: `if '(' exp ')' (stmt | '{' stmt* '}')` })
  .define({ const_stmt: `const identifier '=' exp_stmt` })
  .define({ let_stmt: `let identifier '=' exp_stmt` })
  .define({ while_stmt: `while '(' exp ')' (stmt | '{' stmt* '}')` })
  .define({ break_stmt: `break ';'` })
  .define({
    // these statements can exist in blocks
    // some of them can also exist in top level
    // if they can't exist in top level, we can throw exception when parsing
    // for now for simplicity we treat them all as statements
    stmt: `exp_stmt | if_stmt | const_stmt | let_stmt | while_stmt | break_stmt`,
  })
  // the import statement can only exist in top level
  // so we don't need to define it in stmt
  .define({
    import_stmt: [
      `import '*' as identifier from string ';'`,
      `import '{' identifier (',' identifier)* '}' from string ';'`,
    ],
  })
  // only these statements can exist in top level
  .entry("import_stmt", "stmt")
  .priority(
    // ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence#table
    { exp: `exp '?'? '.' identifier` },
    [{ exp: `exp '(' exps? ')'` }, { exp: `exp '[' exp ']'` }],
    [{ exp: `'!' exp` }, { exp: `'...' exp` }],
    [{ exp: `exp '!=' exp` }, { exp: `exp '&&' exp` }],
    { exps: `exp (',' exp)*` },
    { object_entry: `identifier ":" exp` },
  )
  .resolveRS(
    { exp: `identifier` },
    { object_entry: `identifier ":" exp` },
    { next: "':'", accept: false },
  )
  .resolveRR(
    { exp: `identifier` },
    { object_entry: `identifier` },
    { next: `',' '}'`, accept: false },
  )
  .resolveRR(
    { exp: `identifier` },
    { object_entry: `identifier` },
    { next: `*`, accept: true },
  )
  .resolveRR(
    { object_entry: `identifier` },
    { exp: `identifier` },
    { next: `',' '}'`, accept: true },
  )
  .resolveRR(
    { object_entry: `identifier` },
    { exp: `identifier` },
    { next: `*`, accept: false },
  )
  .resolveRR(
    {
      if_stmt: `if "(" exp ")" "{" "}"`,
      while_stmt: `while "(" exp ")" "{" "}"`,
    },
    { object: `"{" "}"` },
    { next: "*", accept: true },
  );
