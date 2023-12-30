# Retsac

[![npm](https://img.shields.io/npm/v/retsac?style=flat-square)](https://www.npmjs.com/package/retsac)
![coverage](https://img.shields.io/codecov/c/github/DiscreteTom/retsac?style=flat-square)
![build](https://img.shields.io/github/actions/workflow/status/DiscreteTom/retsac/publish.yml?style=flat-square)
![license](https://img.shields.io/github/license/DiscreteTom/retsac?style=flat-square)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/DiscreteTom.vscode-retsac?label=VSCode%20extension&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=DiscreteTom.vscode-retsac)

> [!WARNING]
> This project is still in early development stage, the API may change frequently.

Text lexer and parser. Compiler frontend framework.

This can be used to **_fast prototype_** your own programming language compiler/translator frontend, or parse your domain specific language.

Try it online in the [playground](https://dttk.discretetom.com/js-playground?crushed=%28%27XpenXncieV%27https%253A%252F%252Fcdn.jsXlivr.net%252Fnpm%252FN%25400.15.0%252Fdist%252FN.min.js%27%255D%7EcellVHPYpaY9ULJ%252C%2520ELRI6NOtrue%7Eid%210%29%252CHWrite%2520the%2520PKr9lJZLJ.QXfine%257BUaM%252F123%252F_q%253B--GUpKrIZELR.AdvancedQlJ%257BlJ*XfineD%255C%27a%255C%27_D%2522entry%2522%252C%2520checkAllMtrueI%257D%253BC4418%29%252CHPK9Ys6pKr.pKAll%257B%2522123%2522%257D-Groot6Ys.buffer%255B0%255D--console.log%257Broot.toTYeStringq%257DC5544%29%255D%7EpanelVF5544%252CF4418%255D%29*%257D-zz.-%255Cr%255Cn6%2520%253D%25209%27%7EcoX%21%27GCOfalse%7Eid%21FD%257BUentryMF170372543Gconst%2520H%28%27name%21%27I%2520%29JexerKarseM%253A%2520NYtsacO%27%7EYadonly%21QBuilXr%257B*U%28%2520Vs%21%255BXdeYreZ6new%2520_I*buildq%257B%257Dz%2520%2520%2501zq_ZYXVUQONMKJIHGFDC96-*_).

## Installation

```bash
yarn add retsac
```

## Features

- The Lexer, yield [token](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/model.ts) from the text input string.
  - Regex support. See [examples](#examples) below.
  - [Built-in util functions](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/utils).
    - JavaScript's string literal, numeric literal, integer literal, identifier, etc.
    - JSON's string literal, numeric literal.
  - Support custom functions.
- The Parser, co-work with the lexer and produce an [AST (Abstract Syntax Tree)](https://github.com/DiscreteTom/retsac/blob/main/src/parser/ast.ts).
  - ELR(Expectational LR) parser.
    - **_Meta characters_** like `+*?` when defining a grammar rule.
    - **_Conflict detection_**, try to **_auto resolve conflicts_**.
    - Query children nodes by using `$('name')` instead of `children[index]`.
    - Top-down traverse the AST.
    - Bottom-up reduce data.
    - Expect lexer to yield specific token type and/or content.
    - Try to **_re-lex_** the input if parsing failed.
    - **_DFA serialization & hydration_** to accelerate future building.
  - Serializable AST to co-work with other tools (e.g. compiler backend libs like LLVM).
- Strict type checking with TypeScript.
  - _This is amazing, you'd better try this out by yourself._

## Resources

- [Documentation & API reference. (Deprecated. Working on a new one.)](https://discretetom.github.io/retsac/)
- [A demo programming language which compiles to WebAssembly.](https://github.com/DiscreteTom/dt0)
- [Build tmLanguage.json file in TypeScript with `tmlb`.](https://github.com/DiscreteTom/tmlb)
- [Compose `RegExp` in JavaScript in a readable and maintainable way with `r-compose`.](https://github.com/DiscreteTom/r-compose)
<!-- - [VSCode extension.](https://github.com/DiscreteTom/vscode-retsac) -->

## [Examples](https://github.com/DiscreteTom/retsac/tree/main/examples)

### [JSON Parser](https://github.com/DiscreteTom/retsac/blob/main/examples/parser/json/json.ts)

In this example, we use `AdvancedBuilder` to define grammar rules with `+*?`, define top-down traversers using `traverser`, and query nodes in grammar rules using `$` and `$$`.

All conflicts are auto resolved.

<details open><summary>Click to Expand</summary>

```ts
const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    // built-in support for JSON
    string: Lexer.json.stringLiteral(),
    number: Lexer.json.numericLiteral(),
  })
  .define(Lexer.wordKind("true", "false", "null")) // token's kind name equals to the literal value
  .anonymous(Lexer.exact(..."[]{},:")) // single char borders without a kind name
  .build();

export const builder = new ELR.AdvancedBuilder()
  .lexer(lexer)
  .data<unknown>()
  .define(
    { value: `string | number | true | false | null` },
    // eval the only child's text to get the value
    (d) => d.traverser(({ children }) => eval(children[0].text!)),
  )
  .define(
    { value: `object | array` },
    // call the only child's traverse method to get the object/array value
    (d) => d.traverser(({ children }) => children[0].traverse()),
  )
  .define(
    // `?` for zero or one, `*` for zero or more, use `()` to group
    // quote literal values with `'` or `"`
    { array: `'[' (value (',' value)*)? ']'` },
    // use `$$` to select all children with the given name
    // traverse all values in the array and return the result as an array
    (d) => d.traverser(({ $$ }) => $$(`value`).map((v) => v.traverse())),
  )
  .define({ object: `'{' (object_item (',' object_item)*)? '}'` }, (d) =>
    d.traverser(({ $$ }) => {
      // every object_item's traverse result is an object, we need to merge them
      const result: Record<string, unknown> = {};
      $$(`object_item`).forEach((item) => {
        // traverse the child object_item to get the value, then merge the result
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
      // use `$` to select the first child with the given name
      d.traverser(({ $ }) => {
        const result: Record<string, unknown> = {};
        // remove the double quotes in the key string, then traverse child to get the value
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
const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({ number: /[0-9]+(?:\.[0-9]+)?/ })
  .anonymous(Lexer.exact(..."+-*/()")) // operators
  .build();

export const builder = new ELR.ParserBuilder()
  .data<number>()
  .lexer(lexer)
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

## Contribute

All issues and pull requests are highly welcomed.

## [CHANGELOG](https://github.com/DiscreteTom/retsac/blob/main/CHANGELOG.md)
