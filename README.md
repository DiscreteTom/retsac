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
  - [Built-in util functions](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/utils.ts) makes it super easy to process the input.
  - Support custom error handling functions to prevent interruptions during the process.
  - Support custom functions to yield tokens from the input string.
- The Parser, co-work with the lexer and produce an [AST (Abstract Syntax Tree)](https://github.com/DiscreteTom/retsac/blob/main/src/parser/ast.ts).
  - By default retsac provides an ELR(Expectational LR) parser.
    - Support **meta characters** like `+*?` when defining a grammar rule, just like in Regex.
    - Support **conflict detection** (for reduce-shift conflicts and reduce-reduce conflicts), try to **auto resolve conflicts** by peeking the rest of input, you can also set grammar rule's **priority** or **self-associativity** to auto generate resolvers. Besides, we provide a **code generator** as the low-level API to manually resolve conflict, .
    - Query children nodes by using `$('name')` to avoid accessing them using ugly index like `children[0]`. You can also rename nodes if you want to query nodes with same type using different names.
    - Optional data reducer to make it possible to get a result value when the parse is done.
    - Optional traverser to make it easy to invoke a top-down traverse after the AST is build.
    - Expect lexer to yield specific token type and/or content to parse the input more smartly.
    - Try to re-lex the input if parsing failed. You can rollback global state when re-lex, or commit existing changes to prevent re-lex.
  - The AST can be serialized to a JSON object to co-work with other tools (e.g. compiler backend libs).
- Provide multi-level APIs to make this easy to use and highly customizable.

## Resources

- [Documentation & API reference.](https://discretetom.github.io/retsac/)
- [VSCode extension.](https://github.com/DiscreteTom/vscode-retsac)
- [Demo programming language which compiles to WebAssembly.](https://github.com/DiscreteTom/dt0)

## [Examples](https://github.com/DiscreteTom/retsac/tree/main/example)

### [JSON Parser](https://github.com/DiscreteTom/retsac/blob/main/example/json/json.ts)

In this example, we use `AdvancedBuilder` to define grammar rules using `+*?`, define top-down traversers using `traverser`, and query nodes in grammar rules using `$`.

All conflicts are auto resolved.

<details open><summary>Click to Expand</summary>

```ts
const lexer = new Lexer.Builder()
  .ignore(/^\s/) // ignore blank characters
  .define({
    string: Lexer.stringLiteral({ double: true }), // double quote string literal
    number: /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordType("true", "false", "null")) // type's name is the literal value
  .anonymous(Lexer.exact(..."[]{},:")) // single char borders
  .build();

export const parser = new ELR.AdvancedBuilder<any>()
  .entry("value")
  .define(
    { value: `string | number | true | false | null` },
    // especially, for string use `eval` to make `\\x` become `\x`
    ELR.traverser(({ children }) => eval(children![0].text!))
  )
  .define(
    { value: `object | array` },
    ELR.traverser(({ children }) => children![0].traverse())
  )
  .define(
    { array: `'[' (value (',' value)*)? ']'` },
    ELR.traverser(({ $ }) => $(`value`).map((v) => v.traverse()))
  )
  .define(
    { object: `'{' (object_item (',' object_item)*)? '}'` },
    ELR.traverser(({ $ }) => {
      // every object_item's traverse result is an object, we need to merge them
      const result: { [key: string]: any } = {};
      $(`object_item`).forEach((item) => {
        Object.assign(result, item.traverse());
      });
      return result;
    })
  )
  .define(
    { object_item: `string ':' value` },
    // return an object
    ELR.traverser(({ $ }) => {
      const result: { [key: string]: any } = {};
      result[$(`string`)[0].text!.slice(1, -1)] = $(`value`)[0].traverse();
      return result;
    })
  )
  .build(lexer, { checkAll: true });
```

</details>

### [Calculator](https://github.com/DiscreteTom/retsac/blob/main/example/calculator/core.ts)

In this example, we use `reducer` to define bottom-up data reducers, so we can get result when the AST is built.

There are conflicts introduced by those grammar rules, we use high-level resolver APIs `priority/leftSA` to resolve them.

<details><summary>Click to Expand</summary>

```ts
const lexer = new Lexer.Builder()
  .ignore(/^\s/) // ignore blank characters
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

export const parser = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer(({ matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer<number>(({ values }) => -values[1]!)
  )
  .define(
    { exp: `'(' exp ')'` },
    ELR.reducer(({ values }) => values[1])
  )
  .define(
    { exp: `exp '+' exp` },
    ELR.reducer<number>(({ values }) => values[0]! + values[2]!)
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer<number>(({ values }) => values[0]! - values[2]!)
  )
  .define(
    { exp: `exp '*' exp` },
    ELR.reducer<number>(({ values }) => values[0]! * values[2]!)
  )
  .define(
    { exp: `exp '/' exp` },
    ELR.reducer<number>(({ values }) => values[0]! / values[2]!)
  )
  .priority(
    { exp: `'-' exp` }, // highest priority
    [{ exp: `exp '*' exp` }, { exp: `exp '/' exp` }],
    [{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }] // lowest priority
  )
  .leftSA(
    // left-self-associative, e.g. 1 - 2 - 3 = (1 - 2) - 3 instead of 1 - (2 - 3)
    { exp: `exp '*' exp` },
    { exp: `exp '/' exp` },
    { exp: `exp '+' exp` },
    { exp: `exp '-' exp` }
  )
  .build(lexer, { checkAll: true });
```

</details>

### [Function Definition](https://github.com/DiscreteTom/retsac/blob/main/example/advanced-builder/advanced-builder.ts)

This example shows you how to define a simple `fn_def` grammar rule if you want to build a programming language compiler.

<details><summary>Click to Expand</summary>

```ts
const lexer = new Lexer.Builder()
  .ignore(/^\s/) // ignore blank chars
  .define(Lexer.wordType("pub", "fn", "return", "let")) // keywords
  .define({
    integer: /^([1-9][0-9]*|0)/,
    identifier: /^[a-zA-Z_]\w*/,
  })
  .anonymous(Lexer.exact(..."+-*/():{};=,")) // single char operator
  .build();

export const parser = new ELR.AdvancedBuilder()
  .define({
    // use `@` to rename a node, this is effective only when using `$` to query nodes
    fn_def: `
      pub fn identifier@funcName '(' (param (',' param)*)? ')' ':' identifier@retType '{'
        stmt*
      '}'
    `,
  })
  .define({ param: `identifier ':' identifier` })
  .define({ stmt: `assign_stmt | ret_stmt` }, ELR.commit()) // commit to prevent re-lex, optimize performance
  .define({ assign_stmt: `let identifier ':' identifier '=' exp ';'` })
  .define({ ret_stmt: `return exp ';'` })
  .define({ exp: `integer | identifier` })
  .define({ exp: `exp '+' exp` })
  .entry("fn_def")
  .leftSA({ exp: `exp '+' exp` })
  .build(lexer, { generateResolvers: "builder", checkAll: true });
```

</details>

## Contribute

All issues and pull requests are highly welcomed.

## [CHANGELOG](https://github.com/DiscreteTom/retsac/blob/main/CHANGELOG.md)
