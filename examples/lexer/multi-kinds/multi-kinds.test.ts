import { Lexer } from "../../../src";

test("multi kinds", () => {
  const lexer = new Lexer.Builder()
    .error<string>()
    // use `append` to define actions with kinds set
    .append((a) =>
      a
        .from(Lexer.javascript.numericLiteral())
        // specify possible kinds
        .kinds("odd", "even")
        // select the kind for the output
        .select(({ output }) =>
          Number(output.content) % 2 === 0 ? "even" : "odd",
        )
        // bind different data type for different kinds
        .map({
          even: (_ctx) => ({
            even: true,
          }),
          odd: (_ctx) => ({
            odd: true,
          }),
        })
        // other decorators are also available
        .check(({ output }) =>
          // you can access the kind of the output
          // and do something different for different kinds
          output.kind === "even" ? "even is not accepted" : undefined,
        ),
    )
    .build();

  const odd = lexer.lex("1")!;
  expect(odd.kind).toBe("odd");
  expect(odd.content).toBe("1");
  expect(odd.data).toEqual({ odd: true });
  expect(odd.error).toBeUndefined();

  const even = lexer.lex("2")!;
  expect(even.kind).toBe("even");
  expect(even.content).toBe("2");
  expect(even.data).toEqual({ even: true });
  expect(even.error).toBe("even is not accepted");
});
