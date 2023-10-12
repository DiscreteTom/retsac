import { Lexer, ELR } from "../../../src";

// preserved keywords in TS
// these can't be treated as identifiers
const preserved = [
  "break",
  "as",
  "any",
  "switch",
  "case",
  "if",
  "throw",
  "else",
  "var",
  "number",
  "string",
  "get",
  "module",
  "type",
  "instanceof",
  "typeof",
  "public",
  "private",
  "enum",
  "export",
  "finally",
  "for",
  "while",
  "void",
  "null",
  "super",
  "this",
  "new",
  "in",
  "return",
  "true",
  "false",
  "any",
  "extends",
  "static",
  "let",
  "package",
  "implements",
  "interface",
  "function",
  "new",
  "try",
  "yield",
  "const",
  "continue",
  "do",
  "catch",
] as const;

// keywords in JS
// these can be treated as identifiers
const keywords = ["import", "from", "undefined", "readonly"] as const;

export const lexer = new Lexer.Builder()
  .ignore(
    Lexer.whitespaces(), // blank
    Lexer.comment("//"), // single line comment
    Lexer.comment("/*", "*/"), // multiline comment
  )
  .define(Lexer.wordKind(...preserved, ...keywords))
  .define({
    identifier: Lexer.Action.from(/\w+/).reject(({ content }) =>
      // reject preserved keywords
      (preserved as readonly string[]).includes(content),
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
  // types, simplified
  .define({ type_name: `identifier | readonly identifier '[' ']' | const` })
  // expressions, every expression has a value
  .define({ exps: `exp (',' exps?)?` })
  .define({
    exp: `identifier | string | regex | true | false | object | array | null | undefined`,
  })
  .define({ exp: `exp as type_name` })
  .define({ exp: `'(' exp ')'` })
  .define({ exp: `'(' '{' identifier '}' ')' '=>' '{' stmt* '}'` }) // arrow function
  .define({ exp: `new identifier` }) // new expression
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
  .define({ const_stmt: `const identifier '=' exp_stmt` })
  .define({ export_stmt: `export const_stmt` })
  .define({
    // these statements can exist in blocks
    // some of them can also exist in top level
    // if they can't exist in top level, we can throw exception when parsing
    // for now for simplicity we treat them all as statements
    stmt: `exp_stmt | const_stmt`,
  })
  // the import statement can only exist in top level
  // so we don't need to define it in stmt
  .define({
    import_stmt: [
      `import '*' as identifier from string ';'`,
      `import '{' identifier (',' identifier)* '}' from string ';'`,
    ],
  })
  .priority(
    // ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence#table
    { exp: `exp '?'? '.' identifier` },
    [{ exp: `exp '(' exps? ')'` }, { exp: `exp '[' exp ']'` }],
    [{ exp: `'!' exp` }, { exp: `'...' exp` }],
    [{ exp: `exp '!=' exp` }, { exp: `exp '&&' exp` }],
    { exp: `exp as type_name` },
  );

export const entry = [
  "import_stmt",
  "const_stmt",
  "exp_stmt",
  "export_stmt",
] as const;
