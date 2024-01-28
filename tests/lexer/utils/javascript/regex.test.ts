import { Lexer } from "../../../../src";

function expectAccept(
  lexer: Lexer.Lexer<
    {
      kind: "regex";
      data: Lexer.javascript.RegexLiteralData;
    },
    never,
    never
  >,
  input: string,
  overrides?: Partial<
    Omit<NonNullable<ReturnType<typeof lexer.lex>["token"]>, "data">
  > & {
    data?: Partial<
      Omit<
        NonNullable<ReturnType<typeof lexer.lex>["token"]>["data"],
        "invalid"
      >
    > & {
      invalid?: Partial<
        NonNullable<ReturnType<typeof lexer.lex>["token"]>["data"]["invalid"]
      >;
    };
  },
) {
  const token = lexer.reload(input).lex().token!;
  expect(token.content).toBe(overrides?.content ?? input);
  expect(token.kind).toBe("regex");
  expect(token.error).toBe(undefined);
  expect(token.data.value.source).toBe(
    overrides?.data?.value?.source ?? (eval(input) as RegExp).source,
  );
  expect(token.data.value.flags).toBe(
    overrides?.data?.value?.flags ?? (eval(input) as RegExp).flags,
  );
  if (token.data.invalid !== undefined) {
    expect(token.data.invalid.unterminated).toBe(
      overrides?.data?.invalid?.unterminated ?? false,
    );
    expect(token.data.invalid.flags).toEqual(
      overrides?.data?.invalid?.flags ?? [],
    );
  }
}

describe("regex literal", () => {
  const lexer = new Lexer.Builder()
    .define({ regex: Lexer.javascript.regexLiteral() })
    .build();

  test("non-regex", () => {
    expect(lexer.reload("abc").lex().token).toBe(undefined);
  });

  describe("unterminated", () => {
    test("end of input", () => {
      expectAccept(lexer, "/abc", {
        data: {
          value: /abc/,
          invalid: {
            unterminated: true,
          },
        },
      });
    });

    test("new line", () => {
      expectAccept(lexer, "/abc\n", {
        content: "/abc",
        data: {
          value: /abc/,
          invalid: {
            unterminated: true,
          },
        },
      });
      expectAccept(lexer, "/abc\r", {
        content: "/abc",
        data: {
          value: /abc/,
          invalid: {
            unterminated: true,
          },
        },
      });
      expectAccept(lexer, "/abc\u2028", {
        content: "/abc",
        data: {
          value: /abc/,
          invalid: {
            unterminated: true,
          },
        },
      });
      expectAccept(lexer, "/abc\u2029", {
        content: "/abc",
        data: {
          value: /abc/,
          invalid: {
            unterminated: true,
          },
        },
      });
    });
  });

  describe("escape", () => {
    test("escape the closing slash", () => {
      expectAccept(lexer, "/\\/abc/", {
        data: {
          value: /\/abc/,
        },
      });
    });

    test("escape the opening bracket", () => {
      expectAccept(lexer, "/\\[/", {
        data: {
          value: /\[/,
        },
      });
    });

    test("escape the close bracket", () => {
      expectAccept(lexer, "/\\]/", {
        data: {
          value: /\]/,
        },
      });
    });
  });

  describe("flags", () => {
    test("valid", () => {
      expectAccept(lexer, "/abc/g", {
        data: {
          value: /abc/g,
        },
      });
      expectAccept(lexer, "/abc/m", {
        data: {
          value: /abc/m,
        },
      });
      expectAccept(lexer, "/abc/i", {
        data: {
          value: /abc/i,
        },
      });
      expectAccept(lexer, "/abc/s", {
        data: {
          value: /abc/s,
        },
      });
      expectAccept(lexer, "/abc/u", {
        data: {
          value: /abc/u,
        },
      });
      expectAccept(lexer, "/abc/y", {
        data: {
          value: /abc/y,
        },
      });
      expectAccept(lexer, "/abc/d", {
        data: {
          value: /abc/d,
        },
      });
      expectAccept(lexer, "/abc/v", {
        data: {
          value: new RegExp("abc", "v"),
        },
      });
    });

    test("multi valid", () => {
      expectAccept(lexer, "/abc/dgimsuy", {
        data: {
          value: /abc/dgimsuy,
        },
      });
    });

    test("invalid", () => {
      expectAccept(lexer, "/abc/abc", {
        data: {
          value: /abc/,
          invalid: {
            flags: [5, 6, 7],
          },
        },
      });
    });

    test("mixed valid and invalid", () => {
      expectAccept(lexer, "/abc/dgimsuyabc", {
        data: {
          value: /abc/dgimsuy,
          invalid: {
            flags: [12, 13, 14],
          },
        },
      });
    });
  });
});
