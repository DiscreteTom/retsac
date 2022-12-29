# Retsac

[![npm](https://img.shields.io/npm/v/retsac?color=green&style=flat-square)](https://www.npmjs.com/package/retsac)

Text lexer and parser.

Can be used to fast prototype your own programming language compiler/translator frontend, or parse your domain specific language.

## Installation

```bash
yarn add retsac
```

## Features

- The Lexer, turns a text string to a token list.
  - Regex support. See [examples](https://github.com/DiscreteTom/retsac/tree/main/example) below.
  - [Built-in util functions](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/utils.ts) makes it super easy to process the input.
  - Record each token's start position in the input string and character count in each line.
  - Support custom error handling functions to prevent interruptions during the process.
  - Support custom functions to yield tokens from the input string.
- The Parser, reduce a token list to an AST (Abstract Syntax Tree).
  - By default the lib provides an LR(1) parser.
    - Support conflict detection (for reduce-shift conflicts and reduce-reduce conflicts).
      - Support custom rejecter to resolve conflicts.
      - As an LR(1) parser, the parser will try to auto resolve conflicts by peeking the next AST node.
    - Optional data reducer to make it possible to get a result value when the parse is done.
      - [Built-in util reducer functions](https://github.com/DiscreteTom/retsac/blob/main/src/parser/LR/reducer.ts).
  - Record each AST node's start position in the input string.
  - Support custom error handling functions to prevent interruptions during the process.
  - You can define your own parser as long as it implement the [`IParser`](https://github.com/DiscreteTom/retsac/blob/main/src/parser/model.ts) interface.
  - The AST can be serialized to a JSON object to co-work with other tools (e.g. compiler backend libs).
- Provide multi-level APIs to make this easy to use and highly customizable.

## Contribute

All issues and pull requests are highly welcomed.

## [Examples](https://github.com/DiscreteTom/retsac/tree/main/example)

### [Calculator](https://github.com/DiscreteTom/retsac/blob/main/example/calculator/core.ts)

<details open>
<summary>Click to Expand</summary>
<include path="./example/calculator/core.ts" from="3" to="41" />
</details>

### [JSON Parser](https://github.com/DiscreteTom/retsac/blob/main/example/json.ts)

<details>
<summary>Click to Expand</summary>
<include path="./example/json.ts" from="3" to="80" />
<include path="./example/json.ts" from="3" to="80" />
</details>

## [CHANGELOG](https://github.com/DiscreteTom/retsac/blob/main/CHANGELOG.md)
