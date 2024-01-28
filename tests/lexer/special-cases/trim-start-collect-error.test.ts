import { Lexer } from "../../../src";

test("trim should collect muted errors", () => {
  const lexer = new Lexer.Builder()
    .error<string>()
    .define({
      ws: Lexer.whitespaces().mute().error("error"),
    })
    .build();

  const res = lexer.reload("  ").trim();
  expect(res.errors.length).toBe(1);
  expect(res.errors[0].kind).toBe("ws");
  expect(res.errors[0].content).toBe("  ");
  expect(res.errors[0].error).toBe("error");
});

test("trim should collect non-muted errors", () => {
  const lexer = new Lexer.Builder()
    .error<string>()
    .ignore(Lexer.whitespaces())
    .define({
      a: Lexer.exact("a")
        .mute(() => false) // set never-muted to false to avoid skipped
        .error("error"),
    })
    .build();

  const res = lexer.reload("  a").trim();
  expect(res.errors.length).toBe(1);
});
