import { Lexer } from "../../../src";

describe("stringLiteral", () => {
  function expectAccept<ErrorKinds extends string>(
    lexer: Lexer.Lexer<
      {
        kind: "string";
        data: {
          value: string;
          unclosed: boolean;
          escapes: Lexer.EscapeInfo<ErrorKinds>[];
        };
      },
      never,
      never
    >,
    input: string,
    overrides?: Partial<
      Omit<NonNullable<ReturnType<typeof lexer.lex>>, "data">
    > & {
      data?: Partial<NonNullable<ReturnType<typeof lexer.lex>>["data"]>;
    },
  ) {
    const token = lexer.reset().lex(input)!;
    expect(token.content).toBe(overrides?.content ?? input);
    expect(token.kind).toBe("string");
    expect(token.error).toBe(undefined);
    expect(token.data.value).toBe(overrides?.data?.value ?? input.slice(1, -1));
    expect(token.data.escapes).toEqual(overrides?.data?.escapes ?? []);
    expect(token.data.unclosed).toBe(overrides?.data?.unclosed ?? false);
  }

  function expectReject<ErrorKinds extends string>(
    lexer: Lexer.Lexer<
      {
        kind: "string";
        data: {
          value: string;
          unclosed: boolean;
          escapes: Lexer.EscapeInfo<ErrorKinds>[];
        };
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
      .define({ string: Lexer.stringLiteral(`'`) })
      .build();

    test("reject non-string", () => {
      expectReject(lexer, `123`);
    });

    test("simple", () => {
      expectAccept(lexer, `'123'`);
    });

    test("unclosed will be accepted", () => {
      expectAccept(lexer, `'123`, {
        data: {
          value: `123`,
          unclosed: true,
        },
      });
    });

    test("treat multiline as unclosed", () => {
      expectAccept(lexer, `'123\n'`, {
        content: `'123`,
        data: {
          value: `123`,
          unclosed: true,
        },
      });
    });

    test("escape is disabled", () => {
      expectAccept(lexer, `'\\n'`);
    });
  });

  describe("custom quote", () => {
    test("single or double quote", () => {
      const lexer = new Lexer.Builder()
        .define({
          string: Lexer.stringLiteral(
            (input) =>
              ['"', "'"].includes(input.buffer[input.start])
                ? { accept: true, digested: 1 }
                : { accept: false },
            {
              close: (input, pos) =>
                input.buffer[input.start] === input.buffer[pos]
                  ? { accept: true, digested: 1 }
                  : { accept: false },
            },
          ),
        })
        .build();

      expectAccept(lexer, `'123'`);
      expectAccept(lexer, `"123"`);
    });

    test("js template string", () => {
      const lexer = new Lexer.Builder()
        .define({
          string: Lexer.stringLiteral(
            (input) =>
              input.buffer.startsWith("`", input.start)
                ? { accept: true, digested: 1 }
                : { accept: false },
            {
              close: (input, pos) =>
                input.buffer[pos] === "`"
                  ? { accept: true, digested: 1 }
                  : input.buffer.startsWith("${", pos)
                  ? { accept: true, digested: 2 }
                  : { accept: false },
            },
          ),
        })
        .build();
      expectAccept(lexer, "`123`");
      expectAccept(lexer, "`123${", {
        data: {
          value: "123",
        },
      });
    });
  });

  describe("enable multiline", () => {
    const lexer = new Lexer.Builder()
      .define({ string: Lexer.stringLiteral(`'`, { multiline: true }) })
      .build();

    test("multiline will be accepted", () => {
      expectAccept(lexer, `'123\n'`);
    });
  });

  describe("enable escape", () => {
    describe("no escape handlers", () => {
      const lexer = new Lexer.Builder()
        .define({ string: Lexer.stringLiteral(`'`, { escape: {} }) })
        .build();

      describe("built-in errors", () => {
        test("unterminated", () => {
          expectAccept(lexer, `'\\`, {
            data: {
              value: "\\",
              unclosed: true,
              escapes: [
                {
                  starter: {
                    index: 1,
                    length: 1,
                  },
                  length: 1,
                  value: "\\",
                  error: "unterminated",
                },
              ],
            },
          });
        });
        test("unhandled", () => {
          expectAccept(lexer, `'\\a'`, {
            data: {
              value: "\\a",
              escapes: [
                {
                  starter: {
                    index: 1,
                    length: 1,
                  },
                  length: 1,
                  value: "\\",
                  error: "unhandled",
                },
              ],
            },
          });
        });
      });
    });

    describe("custom escape starter", () => {
      const lexer = new Lexer.Builder()
        .define({
          string: Lexer.stringLiteral(`'`, { escape: { starter: "^^" } }),
        })
        .build();

      test("unterminated", () => {
        expectAccept(lexer, `'^^`, {
          data: {
            value: "^^",
            unclosed: true,
            escapes: [
              {
                starter: {
                  index: 1,
                  length: 2,
                },
                length: 2,
                value: "^^",
                error: "unterminated",
              },
            ],
          },
        });
      });
    });

    describe("commonEscapeHandlers", () => {
      test("map", () => {
        const lexer = new Lexer.Builder()
          .define({
            string: Lexer.stringLiteral(`'`, {
              escape: {
                handlers: [Lexer.commonEscapeHandlers.map({ b: "\b" })],
              },
            }),
          })
          .build();

        expectAccept(lexer, `'\\b'`, {
          data: {
            value: "\b",
            escapes: [
              {
                starter: {
                  index: 1,
                  length: 1,
                },
                length: 2,
                value: "\b",
              },
            ],
          },
        });
      });

      test("line continuation", () => {
        const lexer = new Lexer.Builder()
          .define({
            string: Lexer.stringLiteral(`'`, {
              escape: {
                handlers: [
                  Lexer.commonEscapeHandlers.lineContinuation(["\r\n"]),
                ],
              },
            }),
          })
          .build();

        expectAccept(lexer, `'\\\r\n'`, {
          data: {
            value: "",
            escapes: [
              {
                starter: {
                  index: 1,
                  length: 1,
                },
                length: 3,
                value: "",
              },
            ],
          },
        });
      });

      test("fallback", () => {
        const lexer = new Lexer.Builder()
          .define({
            string: Lexer.stringLiteral(`'`, {
              escape: {
                handlers: [Lexer.commonEscapeHandlers.fallback()],
              },
            }),
          })
          .build();

        expectAccept(lexer, `'\\z'`, {
          data: {
            value: "z",
            escapes: [
              {
                starter: {
                  index: 1,
                  length: 1,
                },
                length: 2,
                value: "z",
                error: "unnecessary",
              },
            ],
          },
        });
      });

      describe("hex", () => {
        describe("default", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [common.hex(), common.fallback()],
                },
              }),
            })
            .build();

          test("not hex", () => {
            expectAccept(lexer, `'\\z'`, {
              data: {
                value: "z",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "z",
                    error: "unnecessary",
                  },
                ],
              },
            });
          });

          test("hex without enough digits", () => {
            expectAccept(lexer, `'\\x`, {
              data: {
                value: "x",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "x",
                    error: "hex",
                  },
                ],
                unclosed: true,
              },
            });
            expectAccept(lexer, `'\\xf`, {
              data: {
                value: "xf",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 3,
                    value: "xf",
                    error: "hex",
                  },
                ],
                unclosed: true,
              },
            });
          });

          test("incorrect hex", () => {
            expectAccept(lexer, `'\\xzz'`, {
              data: {
                value: "zz",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 4,
                    value: "zz",
                    error: "hex",
                  },
                ],
              },
            });
          });

          test("correct hex", () => {
            expectAccept(lexer, `'\\xff'`, {
              data: {
                value: "\xff",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 4,
                    value: "\xff",
                  },
                ],
              },
            });
          });
        });

        describe("reject invalid", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.hex({ acceptInvalid: false }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

          test("not enough digits", () => {
            expectAccept(lexer, `'\\x'`, {
              data: {
                value: "x",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "x",
                    error: "unnecessary",
                  },
                ],
              },
            });
          });

          test("incorrect hex", () => {
            expectAccept(lexer, `'\\xzz'`, {
              data: {
                value: "xzz",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "x",
                    error: "unnecessary",
                  },
                ],
              },
            });
          });
        });
      });
    });
  });

  describe("reject unclosed", () => {
    const lexer = new Lexer.Builder()
      .define({ string: Lexer.stringLiteral(`'`, { acceptUnclosed: false }) })
      .build();

    test("unclosed string literal", () => {
      expectReject(lexer, `'123`);
    });

    test("unclosed string literal with bad escape", () => {
      expectReject(lexer, `'123\\`);
    });
  });
});
