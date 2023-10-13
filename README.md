# Retsac

[![npm](https://img.shields.io/npm/v/retsac?style=flat-square)](https://www.npmjs.com/package/retsac)
![coverage](https://img.shields.io/codecov/c/github/DiscreteTom/retsac?style=flat-square)
![build](https://img.shields.io/github/actions/workflow/status/DiscreteTom/retsac/publish.yml?style=flat-square)
![license](https://img.shields.io/github/license/DiscreteTom/retsac?style=flat-square)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/DiscreteTom.vscode-retsac?label=VSCode%20extension&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=DiscreteTom.vscode-retsac)

Text lexer and parser implemented in pure TypeScript with no external dependencies.

This can be used to **fast prototype** your own programming language compiler/translator frontend, or parse your domain specific language.

## Installation

```bash
yarn add retsac
```

## Features

- The Lexer, turns a text string to a [token](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/model.ts) list.
  - Regex support. See [examples](https://github.com/DiscreteTom/retsac#examples) below.
  - [Built-in util functions](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/utils).
  - Support custom functions to yield tokens from the input string.
- The Parser, co-work with the lexer and produce an [AST (Abstract Syntax Tree)](https://github.com/DiscreteTom/retsac/blob/main/src/parser/ast.ts).
  - ELR(Expectational LR) parser.
    - **_Meta characters_** like `+*?` when defining a grammar rule.
    - **_Conflict detection_**, try to **_auto resolve conflicts_**.
    - Query children nodes by using `$('name')` instead of `children[0]`.
    - Top-down traverse the AST.
    - Bottom-up reduce data.
    - Expect lexer to yield specific token type and/or content.
    - Try to **_re-lex_** the input if parsing failed.
    - **_DFA serialization_** to accelerate future building.
  - Serializable AST to co-work with other tools (e.g. compiler backend libs).
- Strict type checking with TypeScript.
  - Including string literal type checking for token kinds and grammar kinds.

## Resources

- [Documentation & API reference. (WIP)](https://discretetom.github.io/retsac/)
- [VSCode extension.](https://github.com/DiscreteTom/vscode-retsac)
- [Demo programming language which compiles to WebAssembly.](https://github.com/DiscreteTom/dt0)

## [Examples](https://github.com/DiscreteTom/retsac/tree/main/examples)

### [JSON Parser](https://github.com/DiscreteTom/retsac/blob/main/examples/parser/json/json.ts)

In this example, we use `AdvancedBuilder` to define grammar rules with `+*?`, define top-down traversers using `traverser`, and query nodes in grammar rules using `$` and `$$`.

All conflicts are auto resolved.

<details open><summary>Click to Expand</summary>

```ts
export const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    string: Lexer.stringLiteral(`"`), // double quote string literal
    number: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordKind("true", "false", "null")) // type's name is the literal value
  .anonymous(Lexer.exact(..."[]{},:")) // single char borders
  .build();

export const builder = new ELR.AdvancedBuilder()
  .define(
    { value: `string | number | true | false | null` },
    // for string use `eval` to process escaped characters like `\n`
    (d) => d.traverser(({ children }) => eval(children[0].text!)),
  )
  .define({ value: `object | array` }, (d) =>
    d.traverser(({ children }) => children[0].traverse()),
  )
  .define(
    { array: `'[' (value (',' value)*)? ']'` },
    // use `$$` to select all children with the given kind
    (d) => d.traverser(({ $$ }) => $$(`value`).map((v) => v.traverse())),
  )
  .define({ object: `'{' (object_item (',' object_item)*)? '}'` }, (d) =>
    d.traverser(({ $$ }) => {
      // every object_item's traverse result is an object, we need to merge them
      const result: { [key: string]: unknown } = {};
      $$(`object_item`).forEach((item) => {
        Object.assign(result, item.traverse());
      });
      return result;
    }),
  )
  .define(
    // use `@` to rename a grammar
    { object_item: `string@key ':' value` },
    // return an object
    (d) =>
      // use `$` to select the first child with the given kind
      d.traverser(({ $ }) => {
        const result: { [key: string]: unknown } = {};
        // remove the double quotes in the key string
        result[$(`key`)!.text!.slice(1, -1)] = $(`value`)!.traverse();
        return result;
      }),
  );
```

</details>

### [Calculator](https://github.com/DiscreteTom/retsac/blob/main/examples/parser/calculator/calculator.ts)

In this example, we use `reducer` to define bottom-up data reducers, so we can get the result when the AST is built.

There are conflicts introduced by those grammar rules, we use the high-level resolver API `priority` to resolve them.

<details><summary>Click to Expand</summary>

```ts
export const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({ number: /[0-9]+(?:\.[0-9]+)?/ })
  .anonymous(Lexer.exact(..."+-*/()")) // operators
  .build();

export const builder = new ELR.ParserBuilder<number>()
  .define({ exp: "number" }, (d) =>
    // the result of the reducer will be stored in the node's value
    d.reducer(({ matched }) => Number(matched[0].text)),
  )
  .define({ exp: `'-' exp` }, (d) => d.reducer(({ values }) => -values[1]!))
  .define({ exp: `'(' exp ')'` }, (d) => d.reducer(({ values }) => values[1]))
  .define({ exp: `exp '+' exp` }, (d) =>
    d.reducer(({ values }) => values[0]! + values[2]!),
  )
  .define({ exp: `exp '-' exp` }, (d) =>
    d.reducer(({ values }) => values[0]! - values[2]!),
  )
  .define({ exp: `exp '*' exp` }, (d) =>
    d.reducer(({ values }) => values[0]! * values[2]!),
  )
  .define({ exp: `exp '/' exp` }, (d) =>
    d.reducer(({ values }) => values[0]! / values[2]!),
  )
  .priority(
    { exp: `'-' exp` }, // highest priority
    [{ exp: `exp '*' exp` }, { exp: `exp '/' exp` }],
    [{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }], // lowest priority
  );
```

</details>

### [Function Definition](https://github.com/DiscreteTom/retsac/blob/main/examples/parser/advanced-builder/advanced-builder.ts)

This example shows you how to define a simple `fn_def` grammar rule if you want to build a programming language compiler.

<details><summary>Click to Expand</summary>

```ts
export const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank chars
  .define(Lexer.wordKind("pub", "fn", "return", "let")) // keywords
  .define({
    integer: /([1-9][0-9]*|0)/,
    identifier: /[a-zA-Z_]\w*/,
  })
  .anonymous(Lexer.exact(..."+-*/():{};=,")) // single char operator
  .build();

export const builder = new ELR.AdvancedBuilder()
  .define({
    // use `@` to rename a node
    fn_def: `
      pub fn identifier@funcName '(' (param (',' param)*)? ')' ':' identifier@retType '{'
        stmt*
      '}'
    `,
  })
  .define({ param: `identifier ':' identifier` })
  .define({ stmt: `assign_stmt | ret_stmt` }, (d) => d.commit()) // commit to prevent re-lex, optimize performance
  .define({ assign_stmt: `let identifier ':' identifier '=' exp ';'` })
  .define({ ret_stmt: `return exp ';'` })
  .define({ exp: `integer | identifier` })
  .define({ exp: `exp '+' exp` })
  .priority({ exp: `exp '+' exp` });
```

</details>

## Contribute

All issues and pull requests are highly welcomed.

## [CHANGELOG](https://github.com/DiscreteTom/retsac/blob/main/CHANGELOG.md)
