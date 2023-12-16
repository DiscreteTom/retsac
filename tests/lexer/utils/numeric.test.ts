import { Lexer } from "../../../src";

describe("integerLiteral", () => {
  function expectAccept(
    lexer: Lexer.Lexer<
      {
        kind: "int";
        data: Lexer.IntegerLiteralData;
      },
      never,
      never
    >,
    input: string,
    overrides: Partial<
      Omit<NonNullable<ReturnType<typeof lexer.lex>>, "data">
    > & { data: Partial<NonNullable<ReturnType<typeof lexer.lex>>["data"]> },
  ) {
    const token = lexer.reset().lex(input)!;
    expect(token.content).toBe(overrides?.content ?? input);
    expect(token.kind).toBe("int");
    expect(token.error).toBe(undefined);
    expect(token.data.prefix).toEqual(overrides.data?.prefix ?? "");
    expect(token.data.suffix).toEqual(overrides.data?.suffix ?? "");
    expect(token.data.value).toEqual(overrides.data?.value ?? "");
    expect(token.data.separators).toEqual(overrides.data?.separators ?? []);
  }

  function expectReject(
    lexer: Lexer.Lexer<
      {
        kind: "int";
        data: Lexer.IntegerLiteralData;
      },
      never,
      never
    >,
    input: string,
  ) {
    expect(lexer.reset().lex(input)).toBe(null);
  }

  describe("default", () => {
    const lexer = new Lexer.Builder()
      .define({
        int: Lexer.integerLiteral({ prefix: "0a", content: "1" }),
      })
      .build();

    describe("simple", () => {
      test("empty input", () => {
        expectReject(lexer, "");
      });
      test("prefix mismatch", () => {
        expectReject(lexer, "abc");
      });
      test("no content", () => {
        expectAccept(lexer, "0a", {
          data: {
            prefix: "0a",
          },
        });
      });
      describe("accept", () => {
        test("single digit", () => {
          expectAccept(lexer, "0a1", {
            data: {
              prefix: "0a",
              value: "1",
            },
          });
        });
        test("multiple digits", () => {
          expectAccept(lexer, "0a111", {
            data: {
              prefix: "0a",
              value: "111",
            },
          });
        });
      });
    });

    describe("separator is disabled by default", () => {
      test("accept", () => {
        expectAccept(lexer, "0a1_1", {
          content: "0a1",
          data: {
            prefix: "0a",
            value: "1",
          },
        });
      });
    });

    describe("no suffix by default", () => {
      test("accept", () => {
        expectAccept(lexer, "0a1n", {
          content: "0a1",
          data: {
            prefix: "0a",
            value: "1",
          },
        });
      });
    });
  });

  describe("custom separator", () => {
    const lexer = new Lexer.Builder()
      .define({
        int: Lexer.integerLiteral({
          prefix: "0a",
          content: "1",
          separator: "-",
        }),
      })
      .build();

    test("simple", () => {
      expectAccept(lexer, "0a1-1", {
        data: {
          prefix: "0a",
          value: "11",
          separators: [{ index: 3, content: "-" }],
        },
      });
    });

    test("multi separator", () => {
      expectAccept(lexer, "0a1-1-1", {
        data: {
          prefix: "0a",
          value: "111",
          separators: [
            { index: 3, content: "-" },
            { index: 5, content: "-" },
          ],
        },
      });
    });

    test("separators only", () => {
      expectAccept(lexer, "0a--", {
        data: {
          prefix: "0a",
          value: "",
          separators: [
            { index: 2, content: "-" },
            { index: 3, content: "-" },
          ],
        },
      });
    });
  });

  describe("custom suffix", () => {
    const lexer = new Lexer.Builder()
      .define({
        int: Lexer.integerLiteral({
          prefix: "0a",
          content: "1",
          suffix: /[if]/,
        }),
      })
      .build();

    test("simple", () => {
      expectAccept(lexer, "0a1i", {
        data: {
          prefix: "0a",
          value: "1",
          suffix: "i",
        },
      });
      expectAccept(lexer, "0a1f", {
        data: {
          prefix: "0a",
          value: "1",
          suffix: "f",
        },
      });
    });
  });
});
