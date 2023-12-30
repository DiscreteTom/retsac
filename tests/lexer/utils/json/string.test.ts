import { Lexer } from "../../../../src";

function expectAccept<EscapeErrorKinds extends string>(
  lexer: Lexer.Lexer<
    {
      kind: "string";
      data: Lexer.json.StringLiteralData<EscapeErrorKinds>;
    },
    never,
    never
  >,
  input: string,
  overrides?: Partial<
    Omit<NonNullable<ReturnType<typeof lexer.lex>>, "data">
  > & {
    data?: Partial<
      Omit<NonNullable<ReturnType<typeof lexer.lex>>["data"], "invalid">
    > & {
      invalid?: Partial<
        NonNullable<ReturnType<typeof lexer.lex>>["data"]["invalid"]
      >;
    };
  },
) {
  const token = lexer.reset().lex(input)!;
  expect(token.content).toBe(overrides?.content ?? input);
  expect(token.kind).toBe("string");
  expect(token.error).toBe(undefined);
  expect(token.data.value).toBe(overrides?.data?.value ?? input.slice(1, -1));
  expect(token.data.escapes).toEqual(overrides?.data?.escapes ?? []);
  if (token.data.invalid !== undefined) {
    expect(token.data.invalid.unclosed).toBe(
      overrides?.data?.invalid?.unclosed ?? false,
    );
    expect(token.data.invalid.escapes).toEqual(
      overrides?.data?.invalid?.escapes ?? [],
    );
    expect(token.data.invalid.chars).toEqual(
      overrides?.data?.invalid?.chars ?? [],
    );
  }
}

function expectReject(
  lexer: Lexer.Lexer<
    {
      kind: "string";
      data: unknown;
    },
    never,
    never
  >,
  input: string,
) {
  expect(lexer.reset().lex(input)).toBe(null);
}

describe("stringLiteral", () => {
  const lexer = new Lexer.Builder()
    .define({ string: Lexer.json.stringLiteral() })
    .build();

  test("reject non-string", () => {
    expectReject(lexer, `123`);
  });

  test("simple", () => {
    expectAccept(lexer, `"123"`);
  });

  test("unclosed will be accepted", () => {
    expectAccept(lexer, `"123`, {
      data: {
        value: `123`,
        invalid: {
          unclosed: true,
        },
      },
    });
  });

  test("treat multiline as unclosed", () => {
    expectAccept(lexer, `"123\n"`, {
      content: `"123`,
      data: {
        value: `123`,
        invalid: {
          unclosed: true,
        },
      },
    });
  });

  test("simple escapes", () => {
    expectAccept(lexer, `"123\\""`, {
      data: {
        value: `123"`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 2,
            error: undefined,
            value: `"`,
          },
        ],
      },
    });
    expectAccept(lexer, `"123\\\\"`, {
      data: {
        value: `123\\`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 2,
            error: undefined,
            value: `\\`,
          },
        ],
      },
    });
    expectAccept(lexer, `"123\\/"`, {
      data: {
        value: `123/`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 2,
            error: undefined,
            value: `/`,
          },
        ],
      },
    });
    expectAccept(lexer, `"123\\b"`, {
      data: {
        value: `123\b`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 2,
            error: undefined,
            value: `\b`,
          },
        ],
      },
    });
    expectAccept(lexer, `"123\\f"`, {
      data: {
        value: `123\f`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 2,
            error: undefined,
            value: `\f`,
          },
        ],
      },
    });
    expectAccept(lexer, `"123\\n"`, {
      data: {
        value: `123\n`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 2,
            error: undefined,
            value: `\n`,
          },
        ],
      },
    });
    expectAccept(lexer, `"123\\r"`, {
      data: {
        value: `123\r`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 2,
            error: undefined,
            value: `\r`,
          },
        ],
      },
    });
    expectAccept(lexer, `"123\\t"`, {
      data: {
        value: `123\t`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 2,
            error: undefined,
            value: `\t`,
          },
        ],
      },
    });
  });

  test("unicode escape", () => {
    expectAccept(lexer, `"123\\u1234"`, {
      data: {
        value: `123\u1234`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 6,
            error: undefined,
            value: `\u1234`,
          },
        ],
      },
    });
  });

  test("fallback escape", () => {
    expectAccept(lexer, `"123\\x"`, {
      data: {
        value: `123x`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 2,
            error: "unnecessary",
            value: `x`,
          },
        ],
        invalid: {
          escapes: [
            {
              starter: {
                index: 4,
                length: 1,
              },
              length: 2,
              error: "unnecessary",
              value: `x`,
            },
          ],
        },
      },
    });
  });

  test("invalid escape", () => {
    expectAccept(lexer, `"123\\u{"`, {
      data: {
        value: `123u{"`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 4,
            error: "unicode",
            value: `u{"`,
          },
        ],
        invalid: {
          unclosed: true,
          escapes: [
            {
              starter: {
                index: 4,
                length: 1,
              },
              length: 4,
              error: "unicode",
              value: `u{"`,
            },
          ],
        },
      },
    });
  });

  test("invalid escape", () => {
    expectAccept(lexer, `"123\\u{"`, {
      data: {
        value: `123u{"`,
        escapes: [
          {
            starter: {
              index: 4,
              length: 1,
            },
            length: 4,
            error: "unicode",
            value: `u{"`,
          },
        ],
        invalid: {
          unclosed: true,
          escapes: [
            {
              starter: {
                index: 4,
                length: 1,
              },
              length: 4,
              error: "unicode",
              value: `u{"`,
            },
          ],
        },
      },
    });
  });

  test("invalid char", () => {
    expectAccept(lexer, `"123\u0000"`, {
      data: {
        value: `123\u0000`,
        invalid: {
          chars: [4],
        },
      },
    });
  });
});

describe("exactStringLiteral", () => {
  function expectAccept(
    lexer: Lexer.Lexer<
      {
        kind: "string";
        data: undefined;
      },
      never,
      never
    >,
    input: string,
    overrides?: Partial<
      Omit<NonNullable<ReturnType<typeof lexer.lex>>, "data">
    >,
  ) {
    const token = lexer.reset().lex(input)!;
    expect(token.content).toBe(overrides?.content ?? input);
    expect(token.kind).toBe("string");
    expect(token.error).toBe(undefined);
    expect(token.data).toBe(undefined);
  }

  const lexer = new Lexer.Builder()
    .define({ string: Lexer.json.exactStringLiteral() })
    .build();

  test("simple", () => {
    expectAccept(lexer, `"123"`);
  });

  test("reject control char", () => {
    expectReject(lexer, `"123\u0000"`);
  });

  test("simple escape", () => {
    expectAccept(lexer, `"123\\""`);
    expectAccept(lexer, `"123\\\\"`);
    expectAccept(lexer, `"123\\/"`);
    expectAccept(lexer, `"123\\b"`);
    expectAccept(lexer, `"123\\f"`);
    expectAccept(lexer, `"123\\n"`);
    expectAccept(lexer, `"123\\r"`);
    expectAccept(lexer, `"123\\t"`);
  });

  test("reject bad simple escape", () => {
    expectReject(lexer, `"123\\a"`);
  });

  test("unicode escape", () => {
    expectAccept(lexer, `"123\\u1234"`);
  });

  test("reject bad unicode escape", () => {
    expectReject(lexer, `"123\\u{"`);
  });

  test("reject multiline", () => {
    expectReject(lexer, `"123\n"`);
  });

  test("reject unclosed", () => {
    expectReject(lexer, `"123`);
  });
});
