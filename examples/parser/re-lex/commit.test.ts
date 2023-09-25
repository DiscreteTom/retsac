import { parser } from "./commit";

test("commit", () => {
  // because of the commit
  // the parser will try `num '-'` first
  // and commit the changes
  // preventing the re-lex process from overwriting the result
  const res = parser.parseAll("1--1");
  expect(res.accept).toBe(true); // this is partial accepted

  // we the parser got `1-`. it is an expression and be accepted
  // but the rest `-1` can't be further reduced
  expect(parser.lexer.getRest()).toBe("-1");
});
