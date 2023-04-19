<!-- # Lexer -->

The lexer digests the input string and yields a token or a token list.

## Getting Started

```ts
const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces) // ignore blank chars
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()")) // single-char operators
  .build();
```

When you want to create a lexer, the simplest way is to use `Lexer.Builder.build`.

For `Lexer.Builder`, you have the following methods to define your rules:

- `define`: define a rule which will yield the specified token type name.
  - In the example above, we use a regex `/^[0-9]+(?:\.[0-9]+)?/` to define a rule which will yield tokens with the type `number`.
- `anonymous`: define a rule which will yield tokens with no type name(the type name is an empty string).
  - In the example above, we use an util function `Lexer.exact` to define a rule which will yield tokens with no type name.
- `ignore`: define a rule which will yield anonymous muted tokens. _Muted_ means the token will not be emitted when `lex/lexAll`.
  - In the example above, we use a regex `Lexer.whitespaces` to ignore all blank chars.

The lexer will use those rules to lex your input string, from left to right. The lexer will apply those rules by the order you define them, thus the above lexer will first try to ignore blank chars, then try to yield numbers, if no numbers can be yielded, it will try to yield those anonymous operators.

> **Note**: If you use regex as the rule, you might want to make the regex starts with `^` to make it matching from the start of the input string.

Now we have the lexer, let's lex some string:

```ts
lexer.feed("1 + 1");
lexer.lex(); // => yield number(1)
lexer.lex(); // => eat space since it's muted, then yield anonymous(+)
lexer.lex(); // => eat space since it's muted, then yield number(1)
lexer.lex(); // return null since no more token can be emitted
```

You can also combine `feed` & `lex`: `lexer.lex("1 + 1")`, it's equal to `lexer.feed("1 + 1").lex()`.

If you want to lex the entire input, use `lexer.lexAll()`, it will return a token list.

## Lexer State

As you can see, the input string will be stored in the lexer, so you can feed once, and lex for many times.

- To append the buffer with a new input string, just `lexer.feed()`.
- To reset the lexer, call `lexer.reset()`.
- To clone the lexer with its state, call `lexer.clone()`.
- To clone the lexer without its state, call `lexer.dryClone()`.

## Expectation

When you call `lexer.lex`, you can specify the token type and/or content you expected.

```ts
lexer.lex({ expect: { type: "number" } });
lexer.lex({ expect: { type: "number", text: "123" } });
lexer.lex({ expect: { text: "+" } });
lexer.lex({ input: "1 + 1", expect: { text: "+" } });
```

> **Note**: For anonymous tokens, the token type is an empty string.

## Token Position

The lexer will record new line information, so you can ask the lexer to transform an index to a position:

```ts
lexer.lexAll("1 + 1\n1 + 1");
lexer.getPos(6); // => { line: 2, column: 1 }
```

> **Note**: The parameter `index` starts from 0, and the output `line`/`column` starts from 1.

## Lexer Action

When we use `define`/`ignore`/`anonymous` we need to provide an `Action` to specify how to digest the input. Those functions' signature are like:

```ts
function define(defs: { [type: string]: Action });
function ignore(...actions: Action[]);
function anonymous(...actions: Action[]);
```

The `Action` will take the input string as it's parameter, and return an `ActionOutput`:

```ts
export type ActionOutput =
  | { accept: false }
  | {
      /** This action can accept some input as a token. */
      accept: true;
      /** Don't emit token, continue lex. */
      muted: boolean;
      /** How many chars are accepted by this action. */
      digested: number;
      error?: any;
    };
```

So when you use `define`/`ignore`/`anonymous`, you can write your own `Action`:

```ts
// use `new` to create an Action.
builder.ignore(new Action((buffer) => ({ accept: false })));
```

We also provide a `SimpleAction`, you only need to return how many chars are digested, instead of returning an `ActionOutput`:

```ts
// use `Action.from` to transform SimpleAction to Action.
builder.ignore(Action.from((buffer) => buffer.length)); // accept the whole input
builder.ignore(Action.from((buffer) => 0)); // returning 0 or negative numbers means reject
```

`Action.from` can also accept regex as it's parameter:

```ts
builder.ignore(Action.from(/^123/));
```

For simplicity, you can directly use `RegEx` / `Action` / `SimpleAction` when you use `define`/`ignore`/`anonymous`.

```ts
builder.ignore(
  /^123/, // regex
  (buffer) => buffer.length, // simple action function
  new Action((buffer) => ({ accept: false })) // Action object
);
```

You can also modify existing `Action` by using `.mute` / `.check` / `.reject` / `.then` to generate a new `Action`.

```ts
builder.define({
  number: Action.from(/^\d+/).check((s) =>
    Number(s) < 65535 ? undefined : "Literal number overflow"
  ),
});
```

> **Note**: `.mute` / `.check` / `.reject` / `.then` are methods of `Action`, so you have to use `Action.from` or `new Action` to create the `Action` object first.

## Util Functions

Shut up and show you my [code](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/utils.ts).

## Error Handling

Basically you need to handle errors in these two scenarios:

1. The lexer successfully yield a token, but the token value is invalid.
2. The lexer can't yield a token based on your rules.

Here is an example about how to deal with those scenarios:

```ts
builder
  .define({
    number: [
      // for scenario-1, you can use `check` to check the token value and set an error message
      Action.from(/^\d+/).check((s) =>
        Number(s) < 65535 ? undefined : "Literal number overflow"
      ),
      // for scenario-2, if you have some known errors which will cause the lexing failed,
      // define it and make the lexer return a normal token with error
      Action.from(/^0[0-7]+/).check(
        // no need to check token value, just set error
        (_) => "Octal numbers should starts with `0o` instead of `0`"
      ),
    ],
  })
  // for scenario-2, if all rules were failed, you can set a default action to ignore one char
  .ignore((s) => {
    console.log(`Unable to yield a token, try to skip a char: ${s[0]}`);
    return 1;
  });
```

> **Note**: `undefined` means no errors. Errors won't stop `lexAll`, unless you use `lexAll({ stopOnError: true })`.
