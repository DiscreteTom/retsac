# Caster

An easy way to make your own language compiler/translator. Maybe a substitute of flex/bison.

## Usage

### Lexer

```js
let lexer = new Lexer()
  .ignore(/^\s/) // ignore chars
  .define({
    // define token types
    number: /^[0-9]+(?:\.[0-9]+)?/, // regex
    plus: exact("+"), // custom string parser
  })
  .anonymous(exact("-")) // anonymous token
  .overload({
    // multi-rule for one token type
    string: [from_to('"', '"', false), from_to("'", "'", false)],
  })
  .define({
    someError: exact("err").check((content) => `Error: ${content}.`), // error recording
  });

// use lexer
lexer.lex("123");
lexer.lexAll("123");
lexer.hasRest();
lexer.getTokenTypes();
lexer.getPos(token.start);
lexer.getErrors();
```

### Parser

```js
let parser = new ParserManager().setLexer(lexer).add(
  new LRParserBuilder() // to build an LR(1) parser
    .entry("exp") // set entry NT
    .define(
      { exp: "number" }, // define grammar rules
      valueReducer((_, { matched }) => Number(matched[0].text)) // how to get value
    )
    .define(
      { exp: `'-' exp` },
      valueReducer((values) => -values[1]),
      // if previous node is an exp, the `- exp` should be `exp - exp`, reject
      ({ before }) => before.at(-1)?.type == "exp"
    )
    .define(
      { exp: `'(' exp ')'` },
      valueReducer((values) => values[1])
    )
    .define(
      { exp: `exp '+' exp | exp '-' exp` },
      valueReducer((values, { matched }) =>
        matched[1].text == "+" ? values[0] + values[2] : values[0] - values[2]
      ),
      ({ after }) => after[0]?.text == "*" || after[0]?.text == "/"
    )
    .define(
      { exp: `exp '*' exp | exp '/' exp` },
      valueReducer((values, { matched }) =>
        matched[1].text == "*" ? values[0] * values[2] : values[0] / values[2]
      )
    )
    .checkSymbols(lexer.getTokenTypes())
    .build()
);

let res = parser.parseAll("2+3*(4/5)");
console.log(res.buffer[0].toTreeString());
```

Output AST:

```
exp:
  exp:
    number: 2
  <anonymous>: +
  exp:
    exp:
      number: 3
    <anonymous>: *
    exp:
      <anonymous>: (
      exp:
        exp:
          number: 4
        <anonymous>: /
        exp:
          number: 5
      <anonymous>: )
```
