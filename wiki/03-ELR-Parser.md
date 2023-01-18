<!-- # ELR Parser -->

> ELR: Expectational LR

ELR parser will actively use the lexer to retrieve the expected token when it needs more token, instead of lex all the input to a token list once, then construct the AST.

> **Note**: ELR parser is **more recommended** than LR parser.

## ELR Compatibility

ELR parser's API is almost the same as the LR parser's. If you want to change your LR parser to ELR parser, in most cases you just need to globally replace `LR` to `ELR`.

The rest of this article will show you the detailed differences between ELR and LR.

## Expectation

In LR parser, it won't control what token will be emitted by the lexer, so the lexer may emit the wrong token when lexer rules have conflicts.

For example, if we have the following lexer:

```ts
const lexer = new Lexer.Builder()
  .ignore(/^\s/) // ignore blank
  .define({ identifier: /^\w+/ })
  .anonymous(Lexer.exact(..."<>")) // single char operators
  .anonymous(Lexer.exact("<<", ">>")) // double char operators
  .build();

lexer.lexAll("a << b"); // => ['a', '<', '<', 'b']
```

Since we define `<` before `<<`, the lexer will emit `<` immediately. So the output has two `<` instead of one `<<`. To fix this, we can switch the two rules:

```ts
const lexer = new Lexer.Builder()
  .ignore(/^\s/) // ignore blank
  .define({ identifier: /^\w+/ })
  .anonymous(Lexer.exact("<<", ">>")) // double char operators
  .anonymous(Lexer.exact(..."<>")) // single char operators
  .build();

lexer.lexAll("a << b"); // => ['a', '<<', 'b']
```

This works fine. But if we want to use `<>` to express generic types like: `Set<Set<string>>`, obviously the lexer will treat the tail as one `>>` instead of two `>`.

So, during the parse, we want the parser can expect lexer to yield tokens with specific type and/or content.

Introducing ELR parser, if we have the grammar rule:

```ts
new ELR.ParserBuilder().define({
  type: "identifier | generic_type",
  generic_type: "identifier '<' type '>'",
});
```

The parser will ask the lexer to yield a `>` using `lexer.lex({ expect: { type: '', text: '>' } })`, and the parsing will continue.

As you can see, ELR behaves more smart than the LR parser.

## Re-Lex

Since the ELR parser can control its lexer, the parser can try to re-lex the input string when the current parsing failed.

For example, if we have the following lexer and parser:

```ts
const lexer = new Lexer.Builder()
  .ignore(/^\s/)
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

1. The parser ask the lexer to yield a number, got `2`, reduce to a `number` then reduce to an `exp`.
2. According to the grammar rules' order, the parser will ask the lexer to yield `--`, got `--`.
3. The parser reduce `exp` and `--` to an `exp`.
4. The parser try to continue parsing, but failed, since no rule can accept `exp number`.
5. The parser try to re-lex the `--`, according to the grammar rules' order, the parser will ask the lexer to yield `-`, got `-`.
6. Then, the parsing process will successfully finished.

And the re-lex doesn't need us to change any code! ELR YES!

## Parser Context

OK, let's talk about something incompatible with the LR parsers.

In LR parsers, we already change the whole input to a token list, and the token list will be transformed to an AST node list, so the `ParserContext.after` is `ASTNode[]`.

But in ELR parsers, we haven't process the un-lexed input, so the `ParserContext.after` is `string`.

## Definition Context

Since ELR parser can re-lex, maybe the callback and reducer in `DefinitionContext` will be called many times. You may want to make those functions idempotent.
