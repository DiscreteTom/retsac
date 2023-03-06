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
- The Parser, co-work with the lexer and produce an [AST (Abstract Syntax Tree)](https://github.com/DiscreteTom/retsac/blob/main/src/parser/ast.ts).
  - By default the lib provides an ELR(Expectational LR) parser.
    - Support **meta characters** like `+*?` when defining a grammar rule, just like in Regex.
    - Support **conflict detection** (for reduce-shift conflicts and reduce-reduce conflicts), try to **auto resolve conflicts** by peeking the rest of input, and provide a **code generator** to manually resolve conflict.
    - Query children nodes by using `$('name')` to avoid accessing them using ugly index like `children[0]`.
    - Optional data reducer to make it possible to get a result value when the parse is done.
    - Optional traverser to make it easy to invoke a top-down traverse after the AST is build.
    - Expect lexer to yield specific token type and/or content to parse the input more smartly.
    - Try to re-lex the input if parsing failed. You can rollback global state when re-lex, or commit existing changes to prevent re-lex.
  - The AST can be serialized to a JSON object to co-work with other tools (e.g. compiler backend libs).
- Provide multi-level APIs to make this easy to use and highly customizable.

## Resources

- [Documentation](https://github.com/DiscreteTom/retsac/wiki).
- [API reference](https://discretetom.github.io/retsac/).

## [Examples](https://github.com/DiscreteTom/retsac/tree/main/example)

### [JSON Parser](https://github.com/DiscreteTom/retsac/blob/main/example/json/json.ts)

In this example, all conflicts are auto resolved by ELR(1) parser.

<details open>
<summary>Click to Expand</summary>
<include path="./example/json/json.ts" from="3" to="66" />
</details>

### [Calculator](https://github.com/DiscreteTom/retsac/blob/main/example/calculator/core.ts)

In this example, there are many conflicts in the grammar. We use code generator to generate `.resolveRS( ... )` to resolve those conflicts.

<details>
<summary>Click to Expand</summary>
<include path="./example/calculator/core.ts" from="3" to="61" />
</details>

### [AdvancedBuilder](https://github.com/DiscreteTom/retsac/blob/main/example/advanced-builder/advanced-builder.ts)

In this example, we use `AdvancedBuilder` with meta characters like `+*?` in grammar rules to simplify the definition. The `AdvancedBuilder` will auto generate resolvers if the `+*?` introduced conflicts.

<details>
<summary>Click to Expand</summary>
<include path="./example/advanced-builder/advanced-builder.ts" from="3" to="34" />
</details>

## Contribute

All issues and pull requests are highly welcomed.

## [CHANGELOG](https://github.com/DiscreteTom/retsac/blob/main/CHANGELOG.md)
