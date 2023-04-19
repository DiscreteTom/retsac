<!-- # Expectation & Re-Lex -->

## Expectation

In an ELR parser, it won't control what token will be emitted by the lexer, so the lexer may emit the wrong token when the lexer rules have conflicts.

For example, if we have the following lexer:

```ts
const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces) // ignore blank
  .define({ identifier: /^\w+/ })
  .anonymous(Lexer.exact(..."<>")) // single char operators
  .anonymous(Lexer.exact("<<", ">>")) // double char operators
  .build();

lexer.lexAll("a << b"); // => ['a', '<', '<', 'b']
```

Since we define `<` before `<<`, the lexer will emit `<` when lexing. So the output has two `<` instead of one `<<`. To fix this, we can switch the two rules' order:

```ts
const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces) // ignore blank
  .define({ identifier: /^\w+/ })
  .anonymous(Lexer.exact("<<", ">>")) // double char operators
  .anonymous(Lexer.exact(..."<>")) // single char operators
  .build();

lexer.lexAll("a << b"); // => ['a', '<<', 'b']
```

This works fine. But if we want to use `<>` to express generic types like: `Set<Set<string>>`, obviously the lexer will treat the tail as one `>>` instead of two `>`.

So, during the parse, we want the parser can expect the lexer to yield tokens with specific type and/or content.

Introducing ELR parsers, if we have the grammar rule:

```ts
new ELR.ParserBuilder().define({
  type: "identifier | generic_type",
  generic_type: "identifier '<' type '>'",
});
```

The parser will ask the lexer to yield a `>` using `lexer.lex({ expect: { type: '', text: '>' } })`, so the `>>` will be correctly lexed to 2 `>` in generic types.

As you can see, ELR parsers behaves smarter than normal LR parsers.

## Re-Lex

Since the ELR parser can control its lexer, the parser can try to re-lex the input string when the current parsing failed.

For example, if we have the following lexer and parser:

```ts
const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact("--")) // double character operators, will be lexed first
  .anonymous(Lexer.exact("-")) // single character operators, will be lexed second
  .build();

const parser = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `exp '--'` },
    ELR.reducer<number>((values) => values[0]! - 1) // e.g. `2--` is `2 - 1`
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer<number>((values) => -values[1]!)
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer<number>((values) => values[0]! - values[2]!)
  )
  // for simplicity, we omit `.resolveRS` calls
  // see the whole code at: https://github.com/DiscreteTom/retsac/blob/main/example/re-lex/re-lex.ts
  .build(lexer);
```

When we parse `2--1`, the parsing process will be like:

1. The parser asks the lexer to yield a number, gets `2`, reduces it to a `number` then reduces it to an `exp`.
2. According to the grammar rules' order, the parser asks the lexer to yield `'--'`, gets `'--'`.
3. The parser reduces `exp` and `'--'` to an `exp`.
4. The parser tries to continue parsing, but fails, since no rule can accept `exp number`.
5. The parser tries to re-lex the `'--'`, according to the grammar rules' order, the parser asks the lexer to yield `'-'`, got `'-'`.
6. Then, the parsing process will successfully finished.

And the re-lex doesn't need us to change any code! ELR YES!

## Rollback

If you do something in `callback` which changed some global states, then during re-lex you might want to rollback those changes.

The ELR's `DefinitionContext` provides `rollback` for you to define rollback functions:

```ts
let someState = 0;

const parser = new ELR.ParserBuilder<number>()
  .define(
    { exp: `exp '--'` },
    ELR.reducer<number>((values) => values[0]! - 1) // e.g. `2--` is `2 - 1`
      .callback(() => (someState = 1)) // callback will be called if the grammar rule is accepted
      .rollback(() => (someState = 0)) // rollback will be called when re-lex
  )
  ...
```

## Commit

When you think the parser already yield something doesn't need to be re-lexed, you can call `parser.commit` to tell the parser to abandon all other possibilities. This is useful to optimize runtime efficiency and avoid unnecessary re-lex.

For example, when writing a programming language's compiler, we usually won't re-lex when a statement is yield.

```ts
const parser = new ELR.ParserBuilder()
  .entry("assign_stmt", "exp_stmt")
  .define({
    assign_stmt: `let identifier '=' exp ';'`,
    exp_stmt: `exp ';'`,
  })
  .build(lexer);

parser.feed("let a = 123;\nprint(a);");
// yield a top-level NT, in this case, an `assign_stmt`.
parser.parse();
// remove the first ASTNode (assign_stmt)
// since it won't reduce more as the start of a grammar rule
parser.take(1);
// abandon all other possibilities
parser.commit();
// continue parsing
parser.parse();
...
```

You can also commit changes using `DefinitionContext.commit`, the parser will commit when the grammar rule is accepted:

```ts
new ELR.ParserBuilder<number>().define(
  { exp: "number" },
  ELR.reducer((_, { matched }) => Number(matched[0].text)).commit()
);
```

Like other fields in `DefinitionContext`, the `commit` can be a function which accept `ParserContext` and return a boolean:

```ts
new ELR.ParserBuilder<number>().define(
  { exp: "number" },
  ELR.reducer((_, { matched }) => Number(matched[0].text)).commit(
    (ctx) => ctx.after == "123"
  )
);
```
