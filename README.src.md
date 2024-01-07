# Retsac

[![npm](https://img.shields.io/npm/v/retsac?style=flat-square)](https://www.npmjs.com/package/retsac)
![coverage](https://img.shields.io/codecov/c/github/DiscreteTom/retsac?style=flat-square)
![build](https://img.shields.io/github/actions/workflow/status/DiscreteTom/retsac/publish.yml?style=flat-square)
![license](https://img.shields.io/github/license/DiscreteTom/retsac?style=flat-square)

<!-- [![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/DiscreteTom.vscode-retsac?label=VSCode%20extension&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=DiscreteTom.vscode-retsac) -->

> [!WARNING]
> This project is still in early development stage, the API may change frequently.

Text lexer and parser. Compiler frontend framework.

This can be used to **_fast prototype_** your own programming language compiler/translator frontend, or parse your domain specific language.

Try it online in the [playground](https://dttk.discretetom.com/js-playground?crushed=%28%27dependencieV%27https%253A%252F%252Fcdn.jsdelivr.net%252Fnpm%252FN%25400.16.0%252Fdist%252FN.min.js%27%255D%7EcellVKPZpaZC_LQ%252C%2520ELRH9NOtrue%7Eid%210%29%252CKWrite%2520the%2520PMrClQqLQ.BUer%257BYaI%252F123%252FH*bUz%253B--J_pMrHqELR.AdvancedBUerFlQHYXI%255C%27a%255C%27H*bUFXI%2522X%2522%252C%2520checkAllItrueH%257D%253BD4418%29%252CKPMCZs9pMr.pMAll%257B%2522123%2522%257D-Jroot9Zs.buffer%255B0%255D--console.log%257Broot.toTZeStringz%257DD5544%29%255D%7EpanelVG5544%252CG4418%255D%29*%257D-%2520%2520%2520%2520.-%255Cr%255Cn9%2520%253D%2520C%27%7Ecode%21%27JDOfalse%7Eid%21GF%257B_G170372543H%2520%29I%253A%2520Jconst%2520K%28%27name%21%27MarseNZtsacO%27%7EZadonly%21QexerUuildVs%21%255BXentryY*defineFZre_%28%2520q9new%2520z%257B%257D%2501zq_ZYXVUQONMKJIHGFDC9-*_).

## Installation

```bash
yarn add retsac
```

## Features

- The Lexer, yield [token](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/model/token.ts) from the text input string.
  - Regex support. See [examples](#examples) below.
  - [Built-in util functions](https://github.com/DiscreteTom/retsac/tree/main/src/lexer/utils).
    - JavaScript's string literal, numeric literal, integer literal, identifier, etc.
    - JSON's string literal, numeric literal.
  - Support custom functions.
- The Parser, co-work with the lexer and produce an [AST (Abstract Syntax Tree)](https://github.com/DiscreteTom/retsac/blob/main/src/parser/ast).
  - ELR (Expectational LR) parser.
    - **_Meta characters_** like `+*?` when defining a grammar rule.
    - **_Conflict detection_**, try to **_auto resolve conflicts_**.
    - Query children nodes by using `$('name')` instead of `children[index]`.
    - Top-down traverse the AST.
    - Bottom-up reduce data.
    - Expect lexer to yield specific token type and/or content.
    - Try to **_re-lex_** the input if parsing failed.
    - **_DFA serialization & hydration_** to accelerate future building.
  - Serializable AST object to co-work with other tools (e.g. compiler backend libs like LLVM).
- Strict type checking with TypeScript.
  - _This is amazing, you'd better try this out by yourself._

## Resources

- [~~Documentation & API reference~~ (deprecated, working on a new one).](https://discretetom.github.io/retsac/)
- [A demo programming language which compiles to WebAssembly.](https://github.com/DiscreteTom/dt0)
- [Build tmLanguage.json file in TypeScript with `tmlb`.](https://github.com/DiscreteTom/tmlb)
- [Compose `RegExp` in JavaScript in a readable and maintainable way with `r-compose`.](https://github.com/DiscreteTom/r-compose)
<!-- - [VSCode extension.](https://github.com/DiscreteTom/vscode-retsac) -->

## [Examples](https://github.com/DiscreteTom/retsac/tree/main/examples)

### [JSON Parser](https://github.com/DiscreteTom/retsac/blob/main/examples/parser/json/json.ts)

In this example, we use `AdvancedBuilder` to define grammar rules with `+*?`, define top-down traversers using `traverser`, and query nodes in grammar rules using `$` and `$$`.

All conflicts are auto resolved.

<details open>
<summary>Click to Expand</summary>
<include path="./examples/parser/json/json.ts" from="6" to="53" />
</details>

### [Calculator](https://github.com/DiscreteTom/retsac/blob/main/examples/parser/calculator/calculator.ts)

In this example, we use `reducer` to define bottom-up data reducers, so we can get the result when the AST is built.

There are conflicts introduced by those grammar rules, we use the high-level resolver API `priority` to resolve them.

<details>
<summary>Click to Expand</summary>
<include path="./examples/parser/calculator/calculator.ts" from="8" to="38" />
</details>

## Contribute

All issues and pull requests are highly welcomed.

## [CHANGELOG](https://github.com/DiscreteTom/retsac/blob/main/CHANGELOG.md)
