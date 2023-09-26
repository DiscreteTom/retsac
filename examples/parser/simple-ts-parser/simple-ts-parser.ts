import { Lexer, ELR } from "../../../src";

// not all typescript keywords are supported for simplicity
const keywords = [
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
  "null",
  "export",
  "try",
  "catch",
  "undefined",
  "return",
  "readonly",
  "as",
] as const;

export const lexer = new Lexer.Builder()
  .ignore(
    Lexer.whitespaces(), // blank
    Lexer.comment("//"), // single line comment
    Lexer.comment("/*", "*/"), // multiline comment
  )
  .define(Lexer.wordKind(...keywords))
  .define({
    identifier: Lexer.Action.from(/\w+/).reject(({ content }) =>
      (keywords as readonly string[]).includes(content),
    ),
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
  // types
  .define({ type: `readonly? identifier ('[' ']')? | const` })
  // expressions, every expression has a value
  .define({
    exp: `identifier | string | regex | true | false | object | array | null | undefined`, // primary expression
  })
  .define({ exp: `exp as type` })
  .define({ exp: `'(' exp ')'` })
  .define({ exp: `'(' ')' '=>' '{' stmt* '}'` }) // arrow function
  .define({ exp: `new identifier` }) // new expression
  .define({ exp: [`'!' exp`, `'...' exp`] }) // unary expression
  .define({ exp: `exp '?'? '.' identifier` }) // member expression
  .define({ exp: `exp '(' (exp ',')* exp? ')'` }) // call expression
  .define({ exp: `exp '[' exp ']'` }) // index expression
  .define({ exp: [`exp '!=' exp`, `exp '&&' exp`] }) // conditional expression
  // object & array
  .define({ object: `'{' (object_entry (',' object_entry)*)? '}'` })
  .define({ object_entry: `identifier (':' exp)?` })
  .define({ array: `'[' (exp ',')* exp? ']'` })
  // statements
  .define({ exp_stmt: `exp ';'` })
  .define({ ret_stmt: `return exp_stmt` })
  .define({ if_stmt: `if '(' exp ')' (stmt | '{' stmt* '}')` })
  .define({ const_stmt: `const identifier '=' exp_stmt` })
  .define({ let_stmt: `let identifier '=' exp_stmt` })
  .define({ while_stmt: `while '(' exp ')' (stmt | '{' stmt* '}')` })
  .define({ break_stmt: `break ';'` })
  .define({ export_stmt: `export (const_stmt | let_stmt)` })
  .define({
    try_catch_stmt: `try '{' stmt* '}' catch ('(' identifier ')')? '{' stmt* '}'`,
  })
  .define({
    // these statements can exist in blocks
    // some of them can also exist in top level
    // if they can't exist in top level, we can throw exception when parsing
    // for now for simplicity we treat them all as statements
    stmt: `exp_stmt | if_stmt | const_stmt | let_stmt | while_stmt | break_stmt | try_catch_stmt | ret_stmt`,
  })
  // the import statement can only exist in top level
  // so we don't need to define it in stmt
  .define({
    import_stmt: [
      `import '*' as identifier from string ';'`,
      `import '{' identifier (',' identifier)* '}' from string ';'`,
    ],
  })
  // .entry("import_stmt", "stmt", "export_stmt")
  .priority(
    // ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence#table
    { exp: `exp '?'? '.' identifier` },
    [{ exp: `exp '(' (exp ',')* exp? ')'` }, { exp: `exp '[' exp ']'` }],
    [{ exp: `'!' exp` }, { exp: `'...' exp` }],
    [{ exp: `exp '!=' exp` }, { exp: `exp '&&' exp` }],
    { exp: `exp as type` },
  )
  // TODO: optimize the user experience of resolving following conflicts
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
