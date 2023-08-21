<!-- # Lexer -->

The lexer digests the input string and yields a token or a token list.

## Getting Started

```ts
const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces) // ignore blank chars
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/, // use non-capturing group to optimize performance
  })
  .anonymous(Lexer.exact(..."+-*/()")) // single-char operators
  .build();
```

When you want to create a lexer, the simplest way is to use `Lexer.Builder.build`.

For `Lexer.Builder`, you have the following methods to define your rules:

- `define`: define rules which will yield the specified token type name.
  - In the example above, we use a regex `/^[0-9]+(?:\.[0-9]+)?/` to define a rule which will yield tokens with the type `number`.
- `anonymous`: define a rule which will yield tokens with no type name(the type name is an empty string).
  - In the example above, we use an util function `Lexer.exact` to define a rule which will yield tokens with no type name.
- `ignore`: define a rule which will yield anonymous _muted_ tokens. _Muted_ means the token will not be emitted when `lex/lexAll`.
  - In the example above, we use a regex `Lexer.whitespaces` to ignore all blank chars.

The lexer will use those rules to lex your input string, from left to right. The lexer will apply those rules by the order you define them, thus the above lexer will first try to ignore blank chars, then try to yield numbers, if no numbers can be yielded, it will try to yield those anonymous operators.

> **Note**: If you use regex as the rule, you might want to make the regex starts with `^` to make it matching from the start of the rest string.

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
lexer.lex({ expect: { type: "number" } }); // type only
lexer.lex({ expect: { type: "number", text: "123" } }); // type & text
lexer.lex({ expect: { text: "+" } }); // text only
lexer.lex({ input: "1 + 1", expect: { text: "+" } }); // also feed input
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
function define(defs: { [type: string]: ActionSource | ActionSource[] });
function ignore(...actions: ActionSource[]);
function anonymous(...actions: ActionSource[]);
```

The `ActionSource` will be transformed to an `Action` inside the lexer builder.

The `Action` will take `ActionInput` as it's parameter, and return an `ActionOutput`:

```ts
interface IActionInput {
  // the whole input string
  readonly buffer: string;
  // from where to start lex
  readonly start: number;
  // equals to buffer.slice(start), lazy and cached for reuse
  readonly rest: string;
}
interface IAcceptedActionOutput {
  /** This action can accept some input as a token. */
  readonly accept: true;
  /** The whole input string. */
  readonly buffer: string;
  /** From where to lex. */
  readonly start: number;
  /** Don't emit token, continue lex. */
  readonly muted: boolean;
  /** How many chars are accepted by this action. */
  readonly digested: number;
  /** Accept, but set an error to mark this token. */
  readonly error?: any;
  /**
   * The content of the token, equals to `input.slice(start, start + digested)`.
   * This is not lazy since we need this to calculate `lexer.lineChars`.
   */
  readonly content: string;
  // equals to buffer.slice(start + digested), lazy and cached for reuse
  readonly rest: string;
}
export type ActionOutput = Readonly<{ accept: false }> | IAcceptedActionOutput;
```

So when you use `define`/`ignore`/`anonymous`, you can write your own `Action`:

```ts
// use `new` to create an Action.
builder.ignore(new Action(({ buffer }) => ({ accept: false })));
```

We also provide a `SimpleAction` for you to easily create an `Action`:

```ts
// use `Action.from` to transform SimpleAction to Action.
builder.ignore(Action.from(({ buffer }) => 1)); // return a number which is the length of the token
builder.ignore(Action.from(({ buffer, start }) => buffer.length - start)); // accept the whole input
builder.ignore(Action.from(({ buffer }) => 0)); // returning 0 or negative numbers means reject
builder.ignore(Action.from(({ buffer }) => "123")); // return a string as the lex result
// return an SimpleAcceptedActionOutput which is a subset of IAcceptedActionOutput
builder.ignore(
  Action.from(({ buffer }) => ({
    digested: 1,
    // more fields...
  }))
);
```

`Action.from` can also accept regex as it's parameter:

```ts
builder.ignore(Action.from(/^123/));
```

For simplicity, you can directly use `RegEx` / `Action` / `SimpleAction` when you use `define`/`ignore`/`anonymous`.

```ts
builder.ignore(
  /^123/, // regex
  ({ buffer }) => 0, // simple action function
  new Action(({ buffer }) => ({ accept: false })) // Action object
);
```

You can also modify existing `Action` by using `.mute` / `.check` / `.reject` / `.then` to generate a new `Action`.

```ts
builder.define({
  number: Action.from(/^\d+/).check(({ content }) =>
    Number(content) < 65535 ? undefined : "Literal number overflow"
  ),
});
```

> **Note**: `.mute` / `.check` / `.reject` / `.then` are methods of `Action`, so you have to use `Action.from` or `new Action` to create the `Action` object first.

## Util Functions

Shut up and see my [code](https://github.com/DiscreteTom/retsac/blob/main/src/lexer/utils.ts).

## Error Handling

Basically you need to handle errors in these two scenarios:

1. The lexer successfully yield a token, but the token value is invalid.
2. The lexer can't yield a token based on your rules.

Here is an example about how to deal with those scenarios:

```ts
builder
  .define({
    number: [
      // for scenario-1, you can use `check` to check the token value and set an error message.
      // undefined means no errors.
      Action.from(/^\d+/).check(({ content }) =>
        Number(content) < 65535 ? undefined : "Literal number overflow"
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
  .ignore(({ buffer, start }) => {
    console.log(
      `Unable to yield a token, try to skip a char: ${buffer[start]}`
    );
    return 1;
  });
```

> **Note**: `undefined` means no errors. Errors won't stop `lexAll`, unless you use `lexAll({ stopOnError: true })`.

## Performance Optimization

Here are some ways to improve the performance:

1. Reduce the use of `ActionAcceptedOutput.rest` if possible to prevent the lexer from calculating it. However, you can set the `ActionAcceptedOutput._rest` field if your `ActionExec` can yield it so the lexer can reuse it. But don't set it if your `ActionExec` can't yield it, it will be calculated lazily and cached.
2. Reduce the use of `ActionInput.rest`. It is calculated lazily and cached, but abuse it will still cause too many long temporary strings to be created.
3. Keep the `Action.maybeMuted` as `false` if possible. If an `Action` is never muted, the lexer can skip some checks when lexing.
4. Merge multiple `Action` into one `Action` if possible by using `Action.reduce` or `Action.or`. This will reduce the lexer loop times to optimize the performance.
5. Reduce the use of `Lexer.getRest`. If you have to use it, cache the result by yourself.
6. Use util functions in `lexer/utils.ts` which are usually optimized.
