# Retsac

[![npm](https://img.shields.io/npm/v/retsac?color=green&style=flat-square)](https://www.npmjs.com/package/retsac)

Text lexer and parser.

Can be used to make your own programming language compiler/translator frontend, or parse your domain specific language.

## Installation

```bash
yarn add retsac
```

## [Examples](https://github.com/DiscreteTom/retsac/tree/main/example)

### [Calculator](https://github.com/DiscreteTom/retsac/blob/main/example/calculator/core.ts)

```ts
import { Lexer, LR, Manager } from "retsac";

let lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

let parser = new LR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    LR.dataReducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `'-' exp` },
    LR.dataReducer((values) => -values[1]),
    // if previous node is an exp, the `- exp` should be `exp - exp`, reject
    ({ before }) => before.at(-1)?.type == "exp"
  )
  .define(
    { exp: `'(' exp ')'` },
    LR.dataReducer((values) => values[1])
  )
  .define(
    { exp: `exp '+' exp | exp '-' exp` },
    LR.dataReducer((values, { matched }) =>
      matched[1].text == "+" ? values[0] + values[2] : values[0] - values[2]
    ),
    ({ after }) => after[0]?.text == "*" || after[0]?.text == "/"
  )
  .define(
    { exp: `exp '*' exp | exp '/' exp` },
    LR.dataReducer((values, { matched }) =>
      matched[1].text == "*" ? values[0] * values[2] : values[0] / values[2]
    )
  )
  .checkSymbols(lexer.getTokenTypes())
  .build();
```

## [CHANGELOG](https://github.com/DiscreteTom/retsac/blob/main/CHANGELOG.md)
