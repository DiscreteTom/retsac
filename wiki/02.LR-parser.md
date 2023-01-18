# LR Parser

LR parser will first try to use a lexer to lex the whole input to a token list, and then try to reduce the token list to an AST.

## Getting Started

```ts
export const parser = new LR.ParserBuilder()
  .entry("exp")
  .define({ exp: "number" })
  .define({ exp: `'-' exp` })
  .define({ exp: `'(' exp ')'` })
  .define({ exp: `exp '+' exp` })
  .define({ exp: `exp '-' exp` })
  .define({ exp: `exp '*' exp` })
  .define({ exp: `exp '/' exp` })
  .build(lexer);
```

When you want to create an LR parser, the simplest way is to use `LR.ParserBuilder.build`.

You need to call `entry` to set top-level node types before `build`, this is required when we build DFA for the LR parser.

As you can see, literal values are supported in grammar rules. You have to make sure the lexer can lex those literal values to a token.

You can use `define` to define grammar rules. For example, `` { exp: `'-' exp` } `` will reduce a literal `-` node and an `exp` node to a new node, and the new node type is also an `exp`. You can also use `|` to specify multiple rules in one string: `` { exp: `exp '+' exp | exp '-' exp` } ``, which will be expanded to `` { exp: `exp '+' exp` } `` and `` { exp: `exp '-' exp` } ``.

After `build`, we got the parser, let's parse some input:

```ts
// feed input to the internal lexer
parser.feed("1 + 1");
// parse, this will yield a top-level node. In this case, an exp
parser.parse();
```

> **Note**: `parser.parse` will **stop** once it got an top-level node at the head of the AST nodes, so the first `parse` will transform the input to something like: `exp '+' '1'`. You have to continue to call `parser.parse`, or use `parser.parseAll`, to make an exhaustive parsing to transform the input into one AST node.

Like the lexer, you can use `parser.parse("1 + 1")` as the replacement of `parser.feed("1 + 1").parse()`, or use `parser.parseAll("1 + 1")` as the replacement of `parser.feed("1 + 1").parseAll()`. Since the lexer is stateful, the parser is also stateful, and you can use `parser.lexer` to retrieve the inner lexer.

> **Note**: when `builder.build`, you can set the `debug` parameter to `true`, then you will see how the parser is processing the input when parsing.

## Get Result When Parsing is Done

You may want to calculate value while parsing, instead of calculate the value using the AST after the parsing.

`ASTNode` provide a field `data` where you can store your data. The type of `data` is a generic type, you can use `new LR.ParserBuilder<number>` to let the `data` be `number` type.

Then, when you `define` your grammar rules, you can provide a second parameter. The second parameter is a `DefinitionContext`, we will introduce this later. For now, we only need to know that you can use `LR.reducer` to set a reducer for the grammar rule.

```ts
export const parser = new LR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    LR.reducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `'-' exp` },
    LR.reducer((values) => -values[1]!)
  )
  .define(
    { exp: `'(' exp ')'` },
    LR.reducer((values) => values[1])
  )
  .define(
    { exp: `exp '+' exp` },
    LR.reducer((values) => values[0]! + values[2]!)
  )
  .define(
    { exp: `exp '-' exp` },
    LR.reducer((values) => values[0]! - values[2]!)
  )
  .define(
    { exp: `exp '*' exp` },
    LR.reducer((values) => values[0]! * values[2]!)
  )
  .define(
    { exp: `exp '/' exp` },
    LR.reducer((values) => values[0]! / values[2]!)
  )
  .build(lexer);
```

You need to provide a function as the parameter of `LR.reducer`, the function has 2 parameters: data of children nodes, and a `ParserContext`. The return value of the function will be the data of the new AST node.

For LR parser, the `ParserContext` is:

```ts
export interface ParserContext<T> {
  readonly matched: ASTNode<T>[];
  readonly before: ASTNode<T>[];
  readonly after: ASTNode<T>[];
  /** Data of the result AST node. */
  data?: T;
  error?: any;
}
```

In our case, the type parameter `T` is `number`.

So, when we use the grammar rule `{ exp: "number" }` to change literal number to an expression, we will use `Number(matched[0].text)` to transform the literal number to number, and stored in the AST node's data.

Once we have the `number` value in data, we can use other grammar rules like `` { exp: `exp '+' exp` } `` to do calculations, we only need to provide `(values) => values[0]! + values[2]!` as a reducer function. When the parser finish parsing, the data of the root AST node is the result we want.

## Definition Context

The `builder.define` accept 2 parameters: the grammar rule (definition), and the optional `DefinitionContext`.

The `DefinitionContext` will decide what will happen if a grammar rule is accepted. If mainly has 2 functionalities:

1. Callback, which will be called if the grammar rule is accepted.
2. Rejecter, which will be called if the grammar rule is accepted, and if the rejecter returns `true`, the accepted grammar rule will be reject.

Both the callback and the rejecter take the `ParserContext` as the parameter, so you can easily access `matched` / `before` / `after` to know what is happening during the parsing.

You can use `LR.callback` or `LR.rejecter` to create `DefinitionContext`, and it also support chaining: `LR.callback(...).rejecter(...)`.

The `LR.reducer` is a special callback, which will gather all children's data as the function's parameter, and assign the return value to the new node's data. Here is how `LR.reducer` is implemented:

```ts
function reducer(f: (data: (T | undefined)[], context: Ctx) => T | undefined) {
  return this.callback(
    (context) =>
      (context.data = f(
        context.matched.map((node) => node.data),
        context
      ))
  );
}
```

There are 2 special rejecter: `LR.resolveRS` and `LR.resolveRR`, these will be introduced in the next section: Conflicts Handling.

## Conflicts Handling

As you may already known, LR parser will get confused when your grammar rules have conflicts.

For example, if we have a rule: `` { exp: `exp '+' exp` } ``, the rule will form a conflict with itself, because when we parse `1 + 2 + 3`, while we want to reduce `1 + 2`, we may want to reduce `2 + 3` first. That's a reduce-shift conflict.

For another example, if we have a rule `` { exp: `exp '-' exp` } `` and a rule `` { exp: `'-' exp` } ``, when we parse `1 - 1`, we don't know which rule should we use. That's a reduce-reduce conflict.

To resolve these conflicts, usually we will check the next token. For example, if we parse `1 + 2 + 3` and when we got `1 + 2`, we will peek the next token which is `+`, and we know we can calculate `1 + 2` now safely.

To achieve the 'peek next' action, you will need a rejecter in the `DefinitionContext`, which will check the `after`. But you don't need to create the rejecter by yourself, we provide an `LR.resolveRS`, so you only need to specify some options, and you will get the rejecter done.

```ts
builder.define(
  { exp: `exp '+' exp` },
  ELR.reducer<number>((values) => values[0]! + values[2]!)
    .resolveRS({ exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
    .resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
    .resolveRS({ exp: `exp '*' exp` }, { next: `'*'`, reduce: false })
    .resolveRS({ exp: `exp '/' exp` }, { next: `'/'`, reduce: false })
);
```

Similarly, we have `LR.resolveRR` for you to resolve reduce-reduce conflicts.

Sometimes you may want more information to judge whether to reduce, so you can provide an `Accepter` function to the `reduce` option. The `Accepter` function has the same parameter type and return type as `Rejecter`, but the `Accepter` returning `true` means accept instead of reject.

```ts
builder.define(
  { exp: `exp '+' exp` },
  ELR.reducer<number>((values) => values[0]! + values[2]!).resolveRS(
    { exp: `exp '+' exp` },
    { next: `'+'`, reduce: (ctx) => true }
  )
);
```

> **Note**: the `LR.resolveRS` and `LR.resolveRR` will not only add the rejecter to the `DefinitionContext`, but also **mark this conflict as resolved**. When you use `builder.checkConflicts`, the parser builder will ensure all conflicts are marked resolved, otherwise it will throw errors. So, if you want to pass `builder.checkConflicts`, use `LR.resolveRS` and `LR.resolveRR` instead of `LR.rejecter`.

Besides the `DefinitionContext`, you can also use `builder.resolveRS` and `builder.resolveRR` to resolve conflicts, but you have to provide both the grammar rules.

```ts
builder
  .define({ exp: `exp '+' exp` })
  .resolveRS(
    { exp: `exp '+' exp` },
    { exp: `exp '+' exp` },
    { next: `'+'`, reduce: (ctx) => true }
  );
```

With the `builder` style resolving, you can split your parser building process into 2 files, one file is for grammar rule definitions and reducers, another file is for conflicts resolving:

```ts
// file 1
builder.define({ exp: `exp '+' exp` });

// file 2
builder.resolveRS(
  { exp: `exp '+' exp` },
  { exp: `exp '+' exp` },
  { next: `'+'`, reduce: (ctx) => true }
);
```

Since when you have many grammar rules, you will have many many many conflicts. We have a code generator for you to generate those conflict resolving codes, and both 'builder' style and 'context' style are supported:

```ts
// by default, the output is builder style
builder.generateResolvers(lexer);
// output:
// .resolveRS({ exp: `'-' exp` }, { exp: `exp '+' exp` }, { next: `'+'`, reduce: true })
// .resolveRS({ exp: `'-' exp` }, { exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
// .resolveRS({ exp: `'-' exp` }, { exp: `exp '*' exp` }, { next: `'*'`, reduce: true })
// .resolveRS({ exp: `'-' exp` }, { exp: `exp '/' exp` }, { next: `'/'`, reduce: true })
// ...
```

So you only need to copy those output and paste in your code, change the `reduce` field, and it's done!

Another important thing to mention is that, the LR parser will try to auto resolve some conflicts, so you don't need to resolve all conflicts. If you are interested in these code, see [here](https://github.com/DiscreteTom/retsac/blob/main/src/parser/base/builder/utils/conflict.ts).

> **Note**: when `builder.checkConflicts`, you can set the `debug` parameter to `true` to see which conflicts are auto resolved.

## Modularize

You can split your parser builder to many parser builder, and call `builder.use(anotherBuilder)` to enable different functionalities.

## Check Errors Before Build

After you define all your grammar rules, you may want to check there is no typo in your definitions. `builder.checkSymbols` will check if there are undefined symbols, duplicated symbols in lexer and parser, and make sure entry types are defined in the parser instead of the lexer.

You can also use `builder.checkConflicts` to make sure all conflicts are resolved.

The `builder.checkAll` is a shorthand for `builder.checkSymbols().checkConflicts()`.

> **Note**: these checks maybe slow, so you may only want to use them in dev mode and remove those checks in prod.
