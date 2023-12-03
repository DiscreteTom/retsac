import { Lexer } from "../../../src";

test("trimStart should collect muted errors", () => {
  const lexer = new Lexer.Builder()
    .error<string>()
    .define({
      ws: Lexer.whitespaces().mute().error("error"),
    })
    .build();

  lexer.reset().trimStart("  ");
  expect(lexer.hasErrors()).toBe(true);
  expect(lexer.errors[0].kind).toBe("ws");
  expect(lexer.errors[0].content).toBe("  ");
  expect(lexer.errors[0].error).toBe("error");
});

test("trimStart shouldn't collect non-muted errors", () => {
  const lexer = new Lexer.Builder()
    .error<string>()
    .ignore(Lexer.whitespaces())
    .define({
      a: Lexer.exact("a")
        .mute(() => false) // set never-muted to false to avoid skipped
        .error("error"),
    })
    .build();

  lexer.reset().trimStart("  a");
  expect(lexer.hasErrors()).toBe(false);
});
