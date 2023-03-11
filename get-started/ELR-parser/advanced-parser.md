<!-- # Advanced Parser -->

## Advanced Grammar Rule

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
new AdvancedBuilder().define({
  fn_def: `
      pub fn identifier '(' (param (',' param)*)? ')' ':' identifier '{'
        stmt*
      '}'
    `,
});
```

The `AdvancedBuilder` will expand the grammar rules when `build`, so the equivalent `ParserBuilder` code is like:

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

The generated resolvers will make sure the `*+?` search is greedy.

> **Note**: The advanced grammar rules are parsed using a normal ELR parser, so the advanced parser may be slower than a normal ELR parser.

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

But we can use `$` to query those nodes! There is an option called `cascadeQueryPrefix` in `ParserBuilder` and it defaults to `undefined`, when we use `$` to query children and if a child node's name starts with the `cascadeQueryPrefix`, the query will cascade down to the child's children.

When we use `AdvancedBuilder`, the `AdvancedBuilder` will set the `cascadeQueryPrefix` option for us, so we don't need to change anything, just use `AdvancedBuilder` then we can use `$` to cascade query the children nodes.

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

## Traverse vs Reduce

When we use advanced grammar rules, there will be many nested nodes using generated grammar rules. Your definition context like `rejecter/callback` will not be applied to those generated grammar rules, so if you use `reducer` in advanced parser, the reducer process will be broken in generated grammar rules.

But with `traverse` and `cascadeQueryPrefix`, you can skip those generated grammar rules and access nodes as you need, so the `traverse` will work better with `AdvancedBuilder` than `reducer`.

## Advanced Grammar Rules in Conflicts Handling

You can also use `*+?()|` in grammar rules in `builder.resolveRS/resolveRR`, those grammar rules will be expanded as well.

Since `builder.priority/leftSA/rightSA` will call `builder.resolveRS/resolveRR`, so those high-level APIs also support `+*?()|`.
