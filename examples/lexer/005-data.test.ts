import { Lexer } from "../../src";

test("token data", () => {
  // different kinds of tokens can have different data
  // and the data type is auto inferred
  const lexer = new Lexer.Builder()
    .define({
      A: (a) => a.from(/a/).data((_ctx) => "123"),
      B: (a) => a.from(/b/).data((_ctx) => 123),
    })
    .build("ab");

  let res = lexer.lex();
  let token = res.token!;
  expect(token.kind).toBe("A");
  // token kind is bounded with the data type
  // when we check `token.kind` in the if statement
  // the data type will be inferred
  if (token.kind === "A") expect(token.data).toBe("123");

  res = lexer.lex();
  token = res.token!;
  expect(token.kind).toBe("B");
  if (token.kind === "B") expect(token.data).toBe(123);
});

test("data for multi kind action", () => {
  // for multi kind action, if we use `action.data`, then all kinds will share the same data type.
  // if we still want different data for different kinds
  // we can use a mapper to map those kinds to different data
  const lexer = new Lexer.Builder()
    .append((a) =>
      a
        .from(/a/)
        .kinds("A", "B")
        .select((ctx) => (ctx.output.hasRest() ? "A" : "B"))
        .map({
          A: (_ctx) => "123",
          B: (_ctx) => 123,
        }),
    )
    .build("ab");

  let res = lexer.lex();
  let token = res.token!;
  expect(token.kind).toBe("A");
  // and the data type is auto inferred as well
  if (token.kind === "A") expect(token.data).toBe("123");

  res = lexer.lex();
  token = res.token!;
  expect(token.kind).toBe("B");
  if (token.kind === "B") expect(token.data).toBe(123);
});
