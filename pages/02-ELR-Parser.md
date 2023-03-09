<!-- # ELR Parser -->

> ELR: Expectational LR

The ELR parser will actively use the lexer to retrieve the expected token when it needs more token, and then try to reduce the generated token list to an AST.

## Getting Started

```ts
export const parser = new ELR.ParserBuilder()
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

When you want to create an ELR parser, the simplest way is to use `ELR.ParserBuilder.build`.

You need to call `entry` to set top-level node types before `build`, this is required when we build the DFA for the ELR parser.

As you can see, literal values are supported in grammar rules (such as `'-'`). You have to make sure the lexer can lex those literal values to a token.

You can use `define` to define grammar rules. For example, `` { exp: `'-' exp` } `` will reduce a literal `-` node and an `exp` node to a new node, and the new node's type is also `exp`. You can also use `|` to specify multiple rules in one string: `` { exp: `exp '+' exp | exp '-' exp` } ``, which will be expanded to `` { exp: `exp '+' exp` } `` and `` { exp: `exp '-' exp` } ``.

After `build`, we got the parser, let's parse some input:

```ts
// feed the input to the internal lexer
parser.feed("1 + 1");
// parse, this will yield a top-level node. In this case, an `exp`
parser.parse();
```

> **Note**: `parser.parse` will **stop** once it got an top-level node at the head of the AST nodes, so the first `parse` will transform the input to something like: `exp '+' '1'`. You have to continue to call `parser.parse`, or use `parser.parseAll`, to make an exhaustive parsing to transform the whole input into one `exp`.

Like the lexer, you can use `parser.parse("1 + 1")` as the replacement of `parser.feed("1 + 1").parse()`, or use `parser.parseAll("1 + 1")` as the replacement of `parser.feed("1 + 1").parseAll()`. Since the lexer is stateful, the parser is also stateful, and you can use `parser.lexer` to retrieve the inner lexer.

> **Note**: When `builder.build`, you can set the `debug` parameter to `true`, then you will see how the parser is processing the input when `parser.parse`.

## Get Result When Parsing is Done

You may want to calculate some value while parsing, instead of calculating the value after the parsing using the AST.

`ASTNode` provides a field `data` where you can store your data. The type of `data` is a generic type, you can use `new ELR.ParserBuilder<number>` to let the `data` to be `number` type.

Then, when you `define` your grammar rules, you can provide a second parameter. The second parameter is a `DefinitionContext`, we will introduce this later. For now, we only need to know that you can use `ELR.reducer` to set a reducer for the grammar rule.

```ts
export const parser = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer((values) => -values[1]!)
  )
  .define(
    { exp: `'(' exp ')'` },
    ELR.reducer((values) => values[1])
  )
  .define(
    { exp: `exp '+' exp` },
    ELR.reducer((values) => values[0]! + values[2]!)
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer((values) => values[0]! - values[2]!)
  )
  .define(
    { exp: `exp '*' exp` },
    ELR.reducer((values) => values[0]! * values[2]!)
  )
  .define(
    { exp: `exp '/' exp` },
    ELR.reducer((values) => values[0]! / values[2]!)
  )
  .build(lexer);
```

You need to provide a function as the parameter of `ELR.reducer`, the function has 2 parameters: data of children nodes, and a `ParserContext`. The return value of the function will be the data of the new AST node.

For ELR parsers, the `ParserContext` is:

```ts
/** Parser context for ELR parsers. */
export interface ParserContext<T> {
  readonly matched: readonly ASTNode<T>[];
  readonly before: readonly ASTNode<T>[];
  readonly after: string;
  /** Find AST node by its type name. */
  readonly $: ASTNodeQuerySelector<T>;
  readonly lexer: ILexer;
  /** Data of the result AST node. */
  data?: T;
  error?: any;
}
```

In our case, the type parameter `T` is `number`.

So, when we use the grammar rule `{ exp: "number" }` to transform a literal number node to an expression node, the parser will use `Number(matched[0].text)` to transform the literal number to a number value, and stored in the new AST node's data.

Once we have the `number` value in data, we can use other grammar rules like `` { exp: `exp '+' exp` } `` to do calculations, we only need to provide functions like `(values) => values[0]! + values[2]!` as the reducer function. When the parser finishes parsing, the data of the root AST node is the result we want.

## Definition Context

The `builder.define` accept 2 parameters: the grammar rule (definition), and the optional `DefinitionContext`.

The `DefinitionContext` will decide what will happen if a grammar rule is accepted. It mainly has 2 functionalities:

1. Callback, which will be called if the grammar rule is accepted.
2. Rejecter, which will be called if the grammar rule is accepted. And if the rejecter returns `true`, the accepted grammar rule will be rejected.

Both the callback and the rejecter take the `ParserContext` as the parameter, so you can easily access `matched` / `before` / `after` to know what is happening during the parsing.

You can use `ELR.callback` or `ELR.rejecter` to create `DefinitionContext`, and it also support chaining: `ELR.callback(...).rejecter(...)`.

The `ELR.reducer` is a special callback, which will gather all children's data as the function's parameter, and assign the return value to the new node's data. Here is how `ELR.reducer` is implemented:

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

There are 2 special rejecters: `ELR.resolveRS` and `ELR.resolveRR`, these will be introduced in the next section: _Conflicts Handling_.

## ASTNode Query Selector

You can use `ParserContext.$/ASTNode.$` to query children nodes by their names.

For example, consider the grammar rule `pub fn identifier '(' params ')' identifier '{' stmts '}'`, you can use `$('identifier')` to get the identifier node list. This is better than using `children[x]` to locate a node.

You can also rename a node using `@`, for example: `pub fn identifier@funcName '(' params ')' identifier@retType '{' stmts '}'`, so you can use `$('funcName')` and `$('retName')` to locate different identifiers.

> **Warning**: Once you rename a node, you can't query the node by its original name any more.

## Conflicts Handling

As you may already known, ELR parser will get confused when your grammar rules have conflicts.

For example, if we have a rule: `` { exp: `exp '+' exp` } ``, the rule will form a conflict with itself, because when we parse `1 + 2 + 3`, while we want to reduce `1 + 2` (reduce), we may want to reduce `2 + 3` first (shift). That's a reduce-shift conflict.

For another example, if we have a rule `` { exp: `exp '-' exp` } `` and a rule `` { exp: `'-' exp` } ``, when we parse `1 - 1`, we don't know which rule should we use. That's a reduce-reduce conflict.

To resolve these conflicts, usually we will check the next token. For example, if we parse `1 + 2 + 3` and when we got `1 + 2`, we will peek the next token which is `+`, and we know we can calculate `1 + 2` now safely. But if we parse `1 + 2 * 3` and when we got `1 + 2`, we peak the next token which is `*`, and we know we need to calculate `2 * 3` first.

To achieve the _peek next_ action, you will need a rejecter in the `DefinitionContext`, which will check the `ParserContext.after`. But you don't need to create the rejecter by yourself, we provide an `ELR.resolveRS` to resolve reduce-shift conflicts, so you only need to specify some options, and you will get the rejecter done.

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

Similarly, we have `ELR.resolveRR` for you to resolve reduce-reduce conflicts.

Sometimes you may want more information to judge whether to reduce, in this case you can provide an `Accepter` function to the `reduce` option. The `Accepter` function has the same parameter type and return type as the `Rejecter`, but the `Accepter` returning `true` means accept instead of reject.

```ts
builder.define(
  { exp: `exp '+' exp` },
  ELR.reducer<number>((values) => values[0]! + values[2]!).resolveRS(
    { exp: `exp '+' exp` },
    { next: `'+'`, reduce: (ctx) => true }
  )
);
```

> **Note**: The `ELR.resolveRS` and `ELR.resolveRR` will not only add the rejecter to the `DefinitionContext`, but also **mark this conflict as resolved**. When you use `builder.checkConflicts`, the parser builder will ensure all conflicts are marked resolved, otherwise it will throw errors. So, if you want to pass `builder.checkConflicts`, use `ELR.resolveRS` and `ELR.resolveRR` instead of `ELR.rejecter` for conflicts handling.

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

With the `builder` style resolving, you can split your parser building code into 2 files, one file is for grammar rule definitions and reducers, the other file is for conflicts resolving:

```ts
// file 1
builder.define(
  { exp: `exp '+' exp` },
  ELR.reducer<number>((values) => values[0]! + values[2]!)
);

// file 2
builder.resolveRS(
  { exp: `exp '+' exp` },
  { exp: `exp '+' exp` },
  { next: `'+'`, reduce: (ctx) => true }
);
```

Since when you have many grammar rules, you will have many many many conflicts, we have a code generator for you to generate those conflict resolving codes, and both _builder_ style and _context_ style are supported:

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

You only need to copy those output and paste in your code, change the `reduce` field, and it's done!

Another important thing to mention is that, the ELR parser will try to auto resolve some conflicts, so you don't need to resolve all conflicts. If you are interested in these code, see [here](https://github.com/DiscreteTom/retsac/blob/main/src/parser/base/builder/utils/conflict.ts).

> **Note**: When `builder.checkConflicts`, you can set the `debug` parameter to `true` to see which conflicts are auto resolved.

## Check Errors Before Build

After you define all your grammar rules, you may want to ensure there is no typo in your definitions. `builder.checkSymbols` will check if there are undefined symbols, duplicated symbols in the lexer and the parser, and make sure entry types are defined in the parser instead of the lexer.

You can also use `builder.checkConflicts` to make sure all conflicts are resolved.

The `builder.checkAll` is a shorthand for `builder.checkSymbols().checkConflicts()`.

> **Note**: These checks might be slow, so you may only want to use them in dev mode and remove those checks in prod.

## AST Serialization

When you finish parsing, you might want to export the AST and use other tools such as a compiler backend to process it.

You can use `ASTNode.toObj` to get a well-formed javascript object [`ASTObj`](https://github.com/DiscreteTom/retsac/blob/main/src/parser/ast.ts), without unnecessary fields and no `undefined` / `null`. You can safely serialize it such as using `JSON.stringify`.

## Error Handling

TODO

> **Warning**: When you enable `stopOnError` when parsing, the parser might got a _partial result_ from the DFA, which means the `ParserOutput.accept` is `true` but we haven't got an top-level node.

## Expectation

In an ELR parser, it won't control what token will be emitted by the lexer, so the lexer may emit the wrong token when the lexer rules have conflicts.

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

Since we define `<` before `<<`, the lexer will emit `<` when lexing. So the output has two `<` instead of one `<<`. To fix this, we can switch the two rules' order:

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
  .build();

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

## Traverse

Sometimes we want to traverse the AST top-down instead of bottom-up using `reducer`. Especially when we want to parse a programming language.

Suppose we have the following input:

```ts
function hello(a) {
  return a;
}
```

If we have the following parser:

```ts
const parser = new ELR.ParserBuilder<number>()
  .entry("fn_def_stmt")
  .define({
    fn_def_stmt: `
      function identifier '(' identifier ')' '{'
        stmt ';'
      '}'
    `,
  })
  .define({ stmt: `return exp` })
  .define({ exp: `identifier` });
```

And if we want to use `ELR.reducer`, we will reduce `exp`, then `stmt`, then `fn_def_stmt`. When we reduce `exp`, we haven't got the parameter in `fn_def_stmt`.

The simplest way to solve this is to do a top-down traverse after the AST is built.

By using `ELR.traverser`:

```ts
const parser = new ELR.ParserBuilder<number>()
  .entry("fn_def_stmt")
  .define(
    {
      fn_def_stmt: `
        function identifier '(' identifier ')' '{'
          stmt ';'
        '}'
      `,
    },
    ELR.traverser(({ $ }) => {
      // store the function name to the var map, with a random value to test
      varMap.set($(`identifier`)[0].text!, 123);
      // store the parameter name to the var map, with a random value to test
      varMap.set($(`identifier`)[1].text!, 456);
      // traverse the function body
      $(`stmt`)[0].traverse();
    })
  )
  .define(
    { stmt: `return exp` },
    // return expression value
    ELR.traverser(({ children }) => children![1].traverse())
  )
  .define(
    { exp: `identifier` },
    // get the value of the variable from the map
    ELR.traverser(({ children }) => varMap.get(children![0].text!)!)
  );
```

> **Warning**: In most cases, you don't want to use `children[x].data` since at this time there is no data in the child, use `children[x].traverse()` instead to get the data.

When we finish the parsing and got the root node, we just need to call `root.traverse()`, then a top-down traverse will be invoked, and you can get what you want.

You don't need to implement the `traverser` for every grammar rule, here is the default traverser:

```ts
function defaultTraverser<T>(self: ASTNode<T>): T | void {
  if (self.children !== undefined) {
    // if there is only one child, use its data or traverse to get its data
    if (self.children.length == 1)
      return self.children![0].data ?? self.children![0].traverse();
    // if there are multiple children, traverse all, don't return anything
    self.children.forEach((c) => c.traverse());
  } else {
    // if there is no children, this node is a T and the traverse should not be called
    throw LR_RuntimeError.traverserNotDefined();
  }
}
```

## AdvancedBuilder

When we define grammar rules, we may want to use some meta characters like `|+?*()`, just like in regex:

```ts
define({
  fn_def: `
    pub fn identifier '(' (param (',' param)*)? ')' ':' identifier '{'
      stmt*
    '}'
  `,
});
```

To achieve this, you can use `AdvancedBuilder` instead of `ParserBuilder`

```ts
new AdvancedBuilder()
  .define({
    fn_def: `
      pub fn identifier '(' (param (',' param)*)? ')' ':' identifier '{'
        stmt*
      '}'
    `,
  })
  .expand(); // return ParserBuilder
```

The `AdvancedBuilder` will expand the grammar rules, so the equivalent `ParserBuilder` code is like:

```ts
new ParserBuilder().define({
  fn_def: `
    pub fn identifier '(' ')' ':' identifier '{'
    '}'
    |
    pub fn identifier '(' ')' ':' identifier '{'
      __1
    '}'
    |
    pub fn identifier '(' param ')' ':' identifier '{'
    '}'
    |
    pub fn identifier '(' param __0 ')' ':' identifier '{'
    '}'
    |
    pub fn identifier '(' param ')' ':' identifier '{'
      __1
    '}'
    |
    pub fn identifier '(' param __0 ')' ':' identifier '{'
      __1
    '}'
  `,
  __0: `',' param | ',' param __0`,
  __1: `stmt | stmt __1`,
});
```

Be ware, since we will use placeholders like `__0`, so the result AST will contain many placeholder nodes. For example, if we parse this input:

```
pub fn main(p1: i32, p2: i32): i32 {
  let a: i32 = 1;
  let b: i32 = 2;
  let c: i32 = a + b;
  return a + b + c;
}
```

The result AST is:

```
fn_def:
  pub: pub
  fn: fn
  identifier: main
  <anonymous>: (
  param:
    identifier: p1
    <anonymous>: :
    identifier: i32
  __0:
    <anonymous>: ,
    param:
      identifier: p2
      <anonymous>: :
      identifier: i32
  <anonymous>: )
  <anonymous>: :
  identifier: i32
  <anonymous>: {
  __1:
    stmt:
      assign_stmt:
        let: let
        identifier: a
        <anonymous>: :
        identifier: i32
        <anonymous>: =
        exp:
          integer: 1
        <anonymous>: ;
    __1:
      stmt:
        assign_stmt:
          let: let
          identifier: b
          <anonymous>: :
          identifier: i32
          <anonymous>: =
          exp:
            integer: 2
          <anonymous>: ;
      __1:
        stmt:
          assign_stmt:
            let: let
            identifier: c
            <anonymous>: :
            identifier: i32
            <anonymous>: =
            exp:
              exp:
                identifier: a
              <anonymous>: +
              exp:
                identifier: b
            <anonymous>: ;
        __1:
          stmt:
            ret_stmt:
              return: return
              exp:
                exp:
                  exp:
                    identifier: a
                  <anonymous>: +
                  exp:
                    identifier: b
                <anonymous>: +
                exp:
                  identifier: c
              <anonymous>: ;
  <anonymous>: }
```

You can see there are many nested `__0` and `__1`.

You might notice that the `AdvancedBuilder` might introduce some conflicts. Don't worry, the `AdvancedBuilder` will auto generate resolvers:

```
Generated Resolver: { __0: `',' param`} | { __0: `',' param __0`}, { next: "*", reduce: false }
Generated Resolver: { __1: `stmt`} | { __1: `stmt __1`}, { next: "*", reduce: false }
```

The generated resolvers will make sure the search is greedy.

## Cascade Query

When using `AdvancedBuilder`, how can we use the `ParserContext`? For example, if we want to get all the `stmt` in `fn_def`, we could't use `children` to locate those nodes:

```ts
new AdvancedBuilder().define(
  {
    fn_def: `
      pub fn identifier '(' (param (',' param)*)? ')' ':' identifier '{'
        stmt*
      '}'
    `,
  },
  ELR.traverser(({ children }) => {
    // We couldn't use children to locate those stmt nodes
    // since placeholders will generate many nested nodes
  })
);
```

But we can use `$` to query those nodes! There is an option called `cascadeQueryPrefix` in `ParserBuilder`, when we use `$` to query children and if a child node's name starts with the `cascadeQueryPrefix`, the query will cascade down to the child's children.

When we use `AdvancedBuilder.expand` to generate a `ParserBuilder`, the `AdvancedBuilder` will set the `cascadeQueryPrefix` option for us, so we don't need to change anything, just use `AdvancedBuilder` then we can use `$` to cascade query the children nodes.

```ts
new AdvancedBuilder().define(
  {
    fn_def: `
      pub fn identifier '(' (param (',' param)*)? ')' ':' identifier '{'
        stmt*
      '}'
    `,
  },
  ELR.traverser(({ $ }) => {
    $("stmt") // => return a stmt node list
      .forEach((stmt) => stmt.traverse()); // we can traverse those stmt node
  })
);
```
