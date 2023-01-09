# Retsac

[![npm](https://img.shields.io/npm/v/retsac?style=flat-square)](https://www.npmjs.com/package/retsac)
![coverage](https://img.shields.io/codecov/c/github/DiscreteTom/retsac?style=flat-square)
![build](https://img.shields.io/github/actions/workflow/status/DiscreteTom/retsac/publish.yml?style=flat-square)
![license](https://img.shields.io/github/license/DiscreteTom/retsac?style=flat-square)

Text lexer and parser.

Can be used to fast prototype your own programming language compiler/translator frontend, or parse your domain specific language.

## Installation

```bash
yarn add retsac
```

## Features

- The Lexer, turns a text string to a [token](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/model.ts) list.
  - Regex support. See [examples](https://github.com/DiscreteTom/retsac#examples) below.
  - [Built-in util functions](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/utils.ts) makes it super easy to process the input.
  - Support custom error handling functions to prevent interruptions during the process.
  - Support custom functions to yield tokens from the input string.
- The Parser, reduce a token list to an [AST (Abstract Syntax Tree)](https://github.com/DiscreteTom/retsac/blob/main/src/parser/ast.ts).
  - By default the lib provides an LR(1) parser.
    - Support conflict detection (for reduce-shift conflicts and reduce-reduce conflicts).
      - As an LR(1) parser, the parser will try to **auto resolve conflicts** by peeking the next AST node.
      - Provide a **code generator** to resolve conflict.
      - Support custom rejecter to resolve conflicts.
    - Optional data reducer to make it possible to get a result value when the parse is done.
  - You can define your own parser as long as it implement the [`IParser`](https://github.com/DiscreteTom/retsac/blob/main/src/parser/model.ts) interface.
  - The AST can be serialized to a JSON object to co-work with other tools (e.g. compiler backend libs).
- Provide multi-level APIs to make this easy to use and highly customizable.

## Contribute

All issues and pull requests are highly welcomed.

## [Examples](https://github.com/DiscreteTom/retsac/tree/main/example)

### [JSON Parser](https://github.com/DiscreteTom/retsac/blob/main/example/json.ts)

In this example, all conflicts are auto resolved by LR(1) parser.

<details open><summary>Click to Expand</summary>

```ts
const lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    string: Lexer.stringLiteral({ double: true }),
    number: /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordType("true", "false", "null"))
  .anonymous(Lexer.exact(..."[]{},:"))
  .build();

const parser = new LR.ParserBuilder<any>()
  .entry("value")
  .define(
    { value: "string | number | true | false | null" },
    // especially, for string use `eval` to make `\\n` become `\n`
    LR.reducer((_, { matched }) => eval(matched[0].text!))
  )
  .define(
    { value: "object | array" },
    LR.reducer((values) => values[0])
  )
  .define(
    { array: `'[' ']'` },
    LR.reducer(() => [])
  )
  .define(
    { array: `'[' values ']'` },
    LR.reducer((values) => values[1])
  )
  .define(
    { values: `value` },
    LR.reducer((values) => values) // values => [values[0]]
  )
  .define(
    { values: `values ',' value` },
    LR.reducer((values) => values[0].concat([values[2]]))
  )
  .define(
    { object: `'{' '}'` },
    LR.reducer(() => ({}))
  )
  .define(
    { object: `'{' object_items '}'` },
    LR.reducer((values) => values[1])
  )
  .define(
    { object_items: `object_item` },
    LR.reducer((values) => values[0])
  )
  .define(
    { object_items: `object_items ',' object_item` },
    // merge objects
    LR.reducer((values) => Object.assign(values[0], values[2]))
  )
  .define(
    { object_item: `string ':' value` },
    // reduce to an object
    LR.reducer((values, { matched }) => {
      const result: { [key: string]: any } = {};
      result[matched[0].text!.slice(1, -1)] = values[2];
      return result;
    })
  )
  // .generateResolver(lexer)
  .checkAll(lexer.getTokenTypes(), lexer)
  .build();
```

</details>

### [Calculator](https://github.com/DiscreteTom/retsac/blob/main/example/calculator/core.ts)

In this example, there are many conflicts in the grammar. We use code generator to generate `.resolveRS( ... )` to resolve those conflicts.

<details><summary>Click to Expand</summary>

```ts
const lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

const parser = new LR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    LR.reducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `'-' exp` },
    LR.reducer<number>((values) => -values[1]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: true })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: true })
  )
  .define(
    { exp: `'(' exp ')'` },
    LR.reducer((values) => values[1])
  )
  .define(
    { exp: `exp '+' exp` },
    LR.reducer<number>((values) => values[0]! + values[2]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: false })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: false })
  )
  .define(
    { exp: `exp '-' exp` },
    LR.reducer<number>((values) => values[0]! - values[2]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: false })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: false })
  )
  .define(
    { exp: `exp '*' exp` },
    LR.reducer<number>((values) => values[0]! * values[2]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: true })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: true })
  )
  .define(
    { exp: `exp '/' exp` },
    LR.reducer<number>((values) => values[0]! / values[2]!)
      .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
      .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: true })
      .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: true })
  )
  .checkAll(lexer.getTokenTypes(), lexer, true)
  .build();
```

</details>

## [CHANGELOG](https://github.com/DiscreteTom/retsac/blob/main/CHANGELOG.md)
