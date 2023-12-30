import { Lexer } from "../../../../src";

test("javascript evalString", () => {
  expect(Lexer.javascript.evalString(`"abc"`)).toBe(`abc`);
  expect(Lexer.javascript.evalString(`"abc\\0"`)).toBe(`abc\0`);
  expect(Lexer.javascript.evalString(`"abc\\'def"`)).toBe(`abc'def`);
  expect(Lexer.javascript.evalString(`"abc\\"def"`)).toBe(`abc"def`);
  expect(Lexer.javascript.evalString(`"abc\\ndef"`)).toBe(`abc\ndef`);
  expect(Lexer.javascript.evalString(`"abc\\\\def"`)).toBe(`abc\\def`);
  expect(Lexer.javascript.evalString(`"abc\\rdef"`)).toBe(`abc\rdef`);
  expect(Lexer.javascript.evalString(`"abc\\vdef"`)).toBe(`abc\vdef`);
  expect(Lexer.javascript.evalString(`"abc\\tdef"`)).toBe(`abc\tdef`);
  expect(Lexer.javascript.evalString(`"abc\\bdef"`)).toBe(`abc\bdef`);
  expect(Lexer.javascript.evalString(`"abc\\fdef"`)).toBe(`abc\fdef`);
  expect(Lexer.javascript.evalString(`"abc\\\ndef"`)).toBe(`abcdef`);
  expect(Lexer.javascript.evalString(`"abc\\\`def"`)).toBe(`abc\`def`);
  expect(Lexer.javascript.evalString(`"abc\\x41def"`)).toBe(`abc\x41def`);
  expect(Lexer.javascript.evalString(`"abc\\u1234def"`)).toBe(`abc\u1234def`);
  expect(Lexer.javascript.evalString(`"abc\\u{2F804}def"`)).toBe(
    `abc\u{2F804}def`,
  );

  // all in one
  expect(
    Lexer.javascript.evalString(
      `"\\0\\'\\"\\n\\\\\\r\\v\\t\\b\\f\\\n\\\`\\x41\\u1234\\u{2F804}"`,
    ),
  ).toBe(`\0'"\n\\\r\v\t\b\f\`\x41\u1234\u{2F804}`);
});

test("javascript evalStringContent", () => {
  expect(Lexer.javascript.evalStringContent(`abc`)).toBe(`abc`);
  expect(Lexer.javascript.evalStringContent(`abc\\0`)).toBe(`abc\0`);
  expect(Lexer.javascript.evalStringContent(`abc\\'def`)).toBe(`abc'def`);
  expect(Lexer.javascript.evalStringContent(`abc\\"def`)).toBe(`abc"def`);
  expect(Lexer.javascript.evalStringContent(`abc\\ndef`)).toBe(`abc\ndef`);
  expect(Lexer.javascript.evalStringContent(`abc\\\\def`)).toBe(`abc\\def`);
  expect(Lexer.javascript.evalStringContent(`abc\\rdef`)).toBe(`abc\rdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\vdef`)).toBe(`abc\vdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\tdef`)).toBe(`abc\tdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\bdef`)).toBe(`abc\bdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\fdef`)).toBe(`abc\fdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\\ndef`)).toBe(`abcdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\\`def`)).toBe(`abc\`def`);
  expect(Lexer.javascript.evalStringContent(`abc\\x41def`)).toBe(`abc\x41def`);
  expect(Lexer.javascript.evalStringContent(`abc\\u1234def`)).toBe(
    `abc\u1234def`,
  );
  expect(Lexer.javascript.evalStringContent(`abc\\u{2F804}def`)).toBe(
    `abc\u{2F804}def`,
  );

  // all in one
  expect(
    Lexer.javascript.evalStringContent(
      `\\0\\'\\"\\n\\\\\\r\\v\\t\\b\\f\\\n\\\`\\x41\\u1234\\u{2F804}`,
    ),
  ).toBe(`\0'"\n\\\r\v\t\b\f\`\x41\u1234\u{2F804}`);
});

function expectAccept<EscapeErrorKinds extends string>(
  lexer: Lexer.Lexer<
    {
      kind: "string";
      data: Lexer.javascript.StringLiteralData<EscapeErrorKinds>;
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
  }
}

function expectReject<EscapeErrorKinds extends string>(
  lexer: Lexer.Lexer<
    {
      kind: "string";
      data: Lexer.javascript.StringLiteralData<EscapeErrorKinds>;
    },
    never,
    never
  >,
  input: string,
) {
  expect(lexer.reset().lex(input)).toBe(null);
}

describe("singleQuoteStringLiteral", () => {
  describe("default", () => {
    const lexer = new Lexer.Builder()
      .define({
        string: Lexer.javascript.singleQuoteStringLiteral(),
      })
      .build();

    test("not single quote string", () => {
      expectReject(lexer, `"abc"`);
    });

    test("correct", () => {
      expectAccept(
        lexer,
        `'abc\\b\\t\\n\\v\\f\\r\\"\\'\\\\\\0\\\r\n\\\n\\\u2028\\\u2029\\xff\\u00ff\\u{00ff}\\a'`,
        {
          data: {
            value: `abc\b\t\n\v\f\r"'\\\0\xff\u00ff\u{00ff}a`,
            escapes: [
              {
                starter: {
                  index: 4,
                  length: 1,
                },
                length: 2,
                value: "\b",
                error: undefined,
              },
              {
                starter: {
                  index: 6,
                  length: 1,
                },
                length: 2,
                value: "\t",
                error: undefined,
              },
              {
                starter: {
                  index: 8,
                  length: 1,
                },
                length: 2,
                value: "\n",
                error: undefined,
              },
              {
                starter: {
                  index: 10,
                  length: 1,
                },
                length: 2,
                value: "\v",
                error: undefined,
              },
              {
                starter: {
                  index: 12,
                  length: 1,
                },
                length: 2,
                value: "\f",
                error: undefined,
              },
              {
                starter: {
                  index: 14,
                  length: 1,
                },
                length: 2,
                value: "\r",
                error: undefined,
              },
              {
                starter: {
                  index: 16,
                  length: 1,
                },
                length: 2,
                value: '"',
                error: undefined,
              },
              {
                starter: {
                  index: 18,
                  length: 1,
                },
                length: 2,
                value: "'",
                error: undefined,
              },
              {
                starter: {
                  index: 20,
                  length: 1,
                },
                length: 2,
                value: "\\",
                error: undefined,
              },
              {
                starter: {
                  index: 22,
                  length: 1,
                },
                length: 2,
                value: "\0",
                error: undefined,
              },
              {
                starter: {
                  index: 24,
                  length: 1,
                },
                length: 3,
                value: "",
                error: undefined,
              },
              {
                starter: {
                  index: 27,
                  length: 1,
                },
                length: 2,
                value: "",
                error: undefined,
              },
              {
                starter: {
                  index: 29,
                  length: 1,
                },
                length: 2,
                value: "",
                error: undefined,
              },
              {
                starter: {
                  index: 31,
                  length: 1,
                },
                length: 2,
                value: "",
                error: undefined,
              },
              {
                starter: {
                  index: 33,
                  length: 1,
                },
                length: 4,
                value: "\xff",
                error: undefined,
              },
              {
                starter: {
                  index: 37,
                  length: 1,
                },
                length: 6,
                value: "\u00ff",
                error: undefined,
              },
              {
                starter: {
                  index: 43,
                  length: 1,
                },
                length: 8,
                value: "\u{00ff}",
                error: undefined,
              },
              {
                starter: {
                  index: 51,
                  length: 1,
                },
                length: 2,
                value: "a",
                error: "unnecessary",
              },
            ],
            invalid: {
              escapes: [
                {
                  starter: {
                    index: 51,
                    length: 1,
                  },
                  length: 2,
                  value: "a",
                  error: "unnecessary",
                },
              ],
            },
          },
        },
      );
    });

    test("unclosed", () => {
      expectAccept(lexer, `'abc`, {
        data: {
          value: "abc",
          invalid: {
            unclosed: true,
          },
        },
      });
    });
  });

  test("reject unclosed", () => {
    const lexer = new Lexer.Builder()
      .define({
        string: Lexer.javascript
          .singleQuoteStringLiteral()
          .reject(Lexer.invalidRejecter),
      })
      .build();

    expectReject(lexer, `'abc`);
  });
});

describe("doubleQuoteStringLiteral", () => {
  describe("default", () => {
    const lexer = new Lexer.Builder()
      .define({
        string: Lexer.javascript.doubleQuoteStringLiteral(),
      })
      .build();

    test("not single quote string", () => {
      expectReject(lexer, `'abc'`);
    });

    test("unclosed", () => {
      expectAccept(lexer, `"abc`, {
        data: {
          value: "abc",
          invalid: {
            unclosed: true,
          },
        },
      });
    });
  });

  test("reject unclosed", () => {
    const lexer = new Lexer.Builder()
      .define({
        string: Lexer.javascript
          .singleQuoteStringLiteral()
          .reject(Lexer.invalidRejecter),
      })
      .build();

    expectReject(lexer, `"abc`);
  });
});

describe("simpleStringLiteral", () => {
  describe("default", () => {
    const lexer = new Lexer.Builder()
      .define({ string: Lexer.javascript.simpleStringLiteral() })
      .build();

    test("single quote", () => {
      expectAccept(lexer, `'abc'`);
      expectAccept(lexer, `'abc"'`);
    });

    test("double quote", () => {
      expectAccept(lexer, `"abc"`);
      expectAccept(lexer, `"abc'"`);
    });
  });

  test("reject unclosed", () => {
    const lexer = new Lexer.Builder()
      .define({
        string: Lexer.javascript
          .simpleStringLiteral()
          .reject(Lexer.invalidRejecter),
      })
      .build();

    expectReject(lexer, `'abc`);
    expectReject(lexer, `'abc"`);
    expectReject(lexer, `"abc`);
    expectReject(lexer, `"abc'`);
  });
});

describe("template string", () => {
  function expectAccept<EscapeErrorKinds extends string>(
    lexer: Lexer.Lexer<
      {
        kind: Lexer.javascript.TemplateStringLiteralKinds;
        data: Lexer.javascript.TemplateStringLiteralData<
          EscapeErrorKinds,
          Lexer.javascript.TemplateStringLiteralKinds
        >;
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
    expect(token.kind).toBe(overrides?.kind);
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
    }
  }

  describe("left", () => {
    const lexer = new Lexer.Builder()
      .append((a) =>
        a
          .from(Lexer.javascript.templateStringLiteralLeft())
          .kinds("start", "simple")
          .select((ctx) => ctx.output.data.kind),
      )
      .build();

    test("simple", () => {
      expectAccept(lexer, "`abc`", {
        kind: "simple",
      });
    });

    test("start", () => {
      expectAccept(lexer, "`abc${", {
        kind: "start",
        data: {
          value: "abc",
        },
      });
    });

    test("multiline", () => {
      expectAccept(lexer, "`abc\n`", {
        kind: "simple",
      });
      expectAccept(lexer, "`abc\n${", {
        kind: "start",
        data: {
          value: "abc\n",
        },
      });
    });

    test("\\$ is not invalid escape", () => {
      expectAccept(lexer, "`abc\\$`", {
        kind: "simple",
        data: {
          value: "abc$",
          escapes: [
            {
              error: undefined,
              length: 2,
              starter: {
                index: 4,
                length: 1,
              },
              value: "$",
            },
          ],
        },
      });
      expectAccept(lexer, "`abc\\${", {
        kind: "simple",
        data: {
          value: "abc${",
          escapes: [
            {
              error: undefined,
              length: 2,
              starter: {
                index: 4,
                length: 1,
              },
              value: "$",
            },
          ],
          invalid: {
            unclosed: true,
          },
        },
      });
    });

    test("\\r\\n will be transformed to \\n", () => {
      expectAccept(lexer, "`abc\r\n`", {
        kind: "simple",
        data: {
          value: "abc\n",
        },
      });
      expectAccept(lexer, "`abc\r\n${", {
        kind: "start",
        data: {
          value: "abc\n",
        },
      });
    });
  });

  describe("right", () => {
    const lexer = new Lexer.Builder()
      .append((a) =>
        a
          .from(Lexer.javascript.templateStringLiteralRight())
          .kinds("middle", "end")
          .select((ctx) => ctx.output.data.kind),
      )
      .build();

    test("end", () => {
      expectAccept(lexer, "}abc`", {
        kind: "end",
      });
    });

    test("middle", () => {
      expectAccept(lexer, "}abc${", {
        kind: "middle",
        data: {
          value: "abc",
        },
      });
    });

    test("multiline", () => {
      expectAccept(lexer, "}abc\n`", {
        kind: "end",
      });
      expectAccept(lexer, "}abc\n${", {
        kind: "middle",
        data: {
          value: "abc\n",
        },
      });
    });

    test("\\$ is not invalid escape", () => {
      expectAccept(lexer, "}abc\\$`", {
        kind: "end",
        data: {
          value: "abc$",
          escapes: [
            {
              error: undefined,
              length: 2,
              starter: {
                index: 4,
                length: 1,
              },
              value: "$",
            },
          ],
        },
      });
      expectAccept(lexer, "}abc\\${", {
        kind: "end",
        data: {
          value: "abc${",
          escapes: [
            {
              error: undefined,
              length: 2,
              starter: {
                index: 4,
                length: 1,
              },
              value: "$",
            },
          ],
          invalid: {
            unclosed: true,
          },
        },
      });
    });

    test("\\r\\n will be transformed to \\n", () => {
      expectAccept(lexer, "}abc\r\n`", {
        kind: "end",
        data: {
          value: "abc\n",
        },
      });
      expectAccept(lexer, "}abc\r\n${", {
        kind: "middle",
        data: {
          value: "abc\n",
        },
      });
    });
  });
});
