import { lexer } from "./string-literal";

function assertEq(input: string) {
  let token = lexer.reset().lex(input);
  if (token == null) throw new Error(`Unable to tokenize ${input}`);
  expect(token.content).toBe(input);
}

test("basic string", () => {
  assertEq(`'123'`);
  assertEq(`"123"`);
  assertEq("`123`");
});

test("escaped string", () => {
  assertEq(`'123\\'456'`);
  assertEq(`'123\\\\'`);
  assertEq(`"123\\"456"`);
  assertEq(`"123\\\\"`);
  assertEq("`123\n456`");
  assertEq("`123\\`456`");
  assertEq("`123\\\\`");
});

test("custom quotes", () => {
  assertEq(`*123*`);
  assertEq(`*123\\*456*`);
  assertEq(`*123\\\\*`);
});

test("custom boundary", () => {
  assertEq(`^123$$`);
  assertEq(`^123\\$$456$$`);
  assertEq(`^123$\\$456$$`);
  assertEq(`^123\\\\$$`);
});
