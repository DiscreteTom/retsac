# Retsac

[![npm](https://img.shields.io/npm/v/retsac?color=green&style=flat-square)](https://www.npmjs.com/package/retsac)

Text lexer and parser.

Can be used to make your own programming language compiler/translator frontend, or parse your domain specific language.

## Installation

```bash
yarn add retsac
```

## [Examples](https://github.com/DiscreteTom/retsac/tree/main/example)

### [Calculator](https://github.com/DiscreteTom/retsac/tree/main/example/calculator)

```ts
import { Lexer, LR, Manager } from "retsac";

let lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

let parser = new LR.ParserBuilder()
  .entry("exp")
  .define(
    { exp: "number" },
    LR.valueReducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `'-' exp` },
    LR.valueReducer((values) => -values[1]),
    // if previous node is an exp, the `- exp` should be `exp - exp`, reject
    ({ before }) => before.at(-1)?.type == "exp"
  )
  .define(
    { exp: `'(' exp ')'` },
    LR.valueReducer((values) => values[1])
  )
  .define(
    { exp: `exp '+' exp | exp '-' exp` },
    LR.valueReducer((values, { matched }) =>
      matched[1].text == "+" ? values[0] + values[2] : values[0] - values[2]
    ),
    ({ after }) => after[0]?.text == "*" || after[0]?.text == "/"
  )
  .define(
    { exp: `exp '*' exp | exp '/' exp` },
    LR.valueReducer((values, { matched }) =>
      matched[1].text == "*" ? values[0] * values[2] : values[0] / values[2]
    )
  )
  .checkSymbols(lexer.getTokenTypes())
  .build();
```

### [JSON Parser](https://github.com/DiscreteTom/retsac/blob/main/example/json.ts)

```ts
import { Lexer, LR, Manager } from "retsac";

let lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    string: Lexer.stringLiteral({ double: true }),
    number: /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordType("true", "false", "null"))
  .anonymous(Lexer.exact(..."[]{},:"))
  .build();

let parser = new LR.ParserBuilder()
  .entry("value")
  .define(
    { value: "string" },
    LR.valueReducer((_, { matched }) => eval(matched[0].text)) // use `eval` to make `\\n` become `\n`
  )
  .define(
    { value: "number" },
    LR.valueReducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { value: "true" },
    LR.valueReducer(() => true)
  )
  .define(
    { value: "false" },
    LR.valueReducer(() => false)
  )
  .define(
    { value: "null" },
    LR.valueReducer(() => null)
  )
  .define(
    { value: "object | array" },
    LR.valueReducer((values) => values[0])
  )
  .define(
    { array: `'[' ']'` },
    LR.valueReducer(() => [])
  )
  .define(
    { array: `'[' values ']'` },
    LR.valueReducer((values) => values[1])
  )
  .define(
    { values: `value` },
    LR.valueReducer((values) => values) // values => [values[0]]
  )
  .define(
    { values: `values ',' value` },
    LR.valueReducer((values) => values[0].concat([values[2]]))
  )
  .define(
    { object: `'{' '}'` },
    LR.valueReducer(() => ({}))
  )
  .define(
    { object: `'{' object_items '}'` },
    LR.valueReducer((values) => values[1])
  )
  .define(
    { object_items: `object_item` },
    LR.valueReducer((values) => values[0])
  )
  .define(
    { object_items: `object_items ',' object_item` },
    LR.valueReducer((values) => Object.assign(values[0], values[2]))
  )
  .define(
    { object_item: `string ':' value` },
    LR.valueReducer((values, { matched }) => {
      let result = {};
      result[matched[0].text.slice(1, -1)] = values[2];
      return result;
    })
  )
  .checkSymbols(lexer.getTokenTypes())
  .build();
```

## [CHANGELOG](https://github.com/DiscreteTom/retsac/blob/main/CHANGELOG.md)
