import { Lexer } from "../../../src";

test("multi kinds", () => {
  const lexer = new Lexer.Builder()
    // use `select` to define actions with multiple kinds
    .select((a) =>
      a
        .from(Lexer.javascript.numericLiteral())
        // specify possible kinds
        .kinds("odd", "even")
        // map the output to the kind
        .map(({ output }) =>
          Number(output.content) % 2 === 0 ? "even" : "odd",
        ),
    )
    .build();

  expect(lexer.lex("1")?.kind).toBe("odd");
  expect(lexer.lex("2")?.kind).toBe("even");
});
