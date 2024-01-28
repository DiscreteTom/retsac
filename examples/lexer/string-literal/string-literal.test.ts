import { lexer } from "./string-literal";

function assertEq(input: string) {
  const token = lexer.reload(input).lex().token;
  if (token === undefined) throw new Error(`Unable to tokenize ${input}`);
  expect(token.content).toBe(input);
}

test("basic string", () => {
  assertEq(`'123'`);
  assertEq(`"123"`);
  assertEq("`123`");
});

test("custom quotes", () => {
  assertEq(`*123*`);
});

test("custom boundary", () => {
  assertEq(`^123$$`);
});
