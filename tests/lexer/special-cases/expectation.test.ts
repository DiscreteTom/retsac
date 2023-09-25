import { Lexer } from "../../../src";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces())
  .anonymous(Lexer.exact("-", "--")) // one action, will only be evaluated once
  .anonymous(Lexer.exact("+"), Lexer.exact("++")) // two actions, will be evaluated twice
  .build();

test("expectation with one action", () => {
  // since Lexer.exact will return '-' before it evaluate '--'
  // and we expect '--' so the result is rejected
  expect(
    lexer.reset().lex({
      input: "--",
      expect: {
        text: "--",
      },
    })?.content,
  ).toBe(undefined);
});

test("expectation with two actions", () => {
  // Lexer.exact will return '+' as a single action, but rejected by expectation
  // and '++' will be evaluated, so the result should be '++'
  expect(
    lexer.reset().lex({
      input: "++",
      expect: {
        text: "++",
      },
    })?.content,
  ).toBe("++");
});
