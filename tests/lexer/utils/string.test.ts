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

      describe("fallback", () => {
        test("default", () => {
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

        test("custom error", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: [
                    Lexer.commonEscapeHandlers.fallback({ error: "fallback" }),
                  ],
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
                  error: "fallback",
                },
              ],
            },
          });
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
                    error: "unnecessary",
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
                    length: 2,
                    value: "x",
                    error: "unnecessary",
                  },
                ],
                unclosed: true,
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

        describe("custom error", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.hex({ error: "hex" }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

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
        });

        test("custom prefix", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.hex({ prefix: "0x" }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

          expectAccept(lexer, `'\\0xff'`, {
            data: {
              value: "\xff",
              escapes: [
                {
                  starter: {
                    index: 1,
                    length: 1,
                  },
                  length: 5,
                  value: "\xff",
                },
              ],
            },
          });
        });

        test("custom hex length", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.hex({ hexLength: 1 }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

          expectAccept(lexer, `'\\xf'`, {
            data: {
              value: "\x0f",
              escapes: [
                {
                  starter: {
                    index: 1,
                    length: 1,
                  },
                  length: 3,
                  value: "\x0f",
                },
              ],
            },
          });
        });
      });

      describe("unicode", () => {
        describe("default", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [common.unicode(), common.fallback()],
                },
              }),
            })
            .build();

          test("not unicode", () => {
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

          test("unicode without enough digits", () => {
            expectAccept(lexer, `'\\u`, {
              data: {
                value: "u",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "u",
                    error: "unnecessary",
                  },
                ],
                unclosed: true,
              },
            });
            expectAccept(lexer, `'\\uf`, {
              data: {
                value: "uf",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "u",
                    error: "unnecessary",
                  },
                ],
                unclosed: true,
              },
            });
            expectAccept(lexer, `'\\uf0`, {
              data: {
                value: "uf0",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "u",
                    error: "unnecessary",
                  },
                ],
                unclosed: true,
              },
            });
          });

          test("incorrect unicode", () => {
            expectAccept(lexer, `'\\uzzzz'`, {
              data: {
                value: "uzzzz",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "u",
                    error: "unnecessary",
                  },
                ],
              },
            });
          });

          test("correct unicode", () => {
            expectAccept(lexer, `'\\uaaff'`, {
              data: {
                value: "\uaaff",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 6,
                    value: "\uaaff",
                  },
                ],
              },
            });
          });
        });

        describe("custom error", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.unicode({ error: "unicode" }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

          test("unicode without enough digits", () => {
            expectAccept(lexer, `'\\u`, {
              data: {
                value: "u",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "u",
                    error: "unicode",
                  },
                ],
                unclosed: true,
              },
            });
            expectAccept(lexer, `'\\uf`, {
              data: {
                value: "uf",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 3,
                    value: "uf",
                    error: "unicode",
                  },
                ],
                unclosed: true,
              },
            });
            expectAccept(lexer, `'\\uf0`, {
              data: {
                value: "uf0",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 4,
                    value: "uf0",
                    error: "unicode",
                  },
                ],
                unclosed: true,
              },
            });
          });

          test("incorrect unicode", () => {
            expectAccept(lexer, `'\\uzzzz'`, {
              data: {
                value: "zzzz",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 6,
                    value: "zzzz",
                    error: "unicode",
                  },
                ],
              },
            });
          });
        });

        test("custom prefix", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.unicode({ prefix: "0u" }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

          expectAccept(lexer, `'\\0u1234'`, {
            data: {
              value: "\u1234",
              escapes: [
                {
                  starter: {
                    index: 1,
                    length: 1,
                  },
                  length: 7,
                  value: "\u1234",
                },
              ],
            },
          });
        });

        test("custom hex length", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.unicode({ hexLength: 6 }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

          expectAccept(lexer, `'\\u003456'`, {
            data: {
              value: "\u3456",
              escapes: [
                {
                  starter: {
                    index: 1,
                    length: 1,
                  },
                  length: 8,
                  value: "\u3456",
                },
              ],
            },
          });
        });
      });

      describe("codepoint", () => {
        describe("default", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [common.codepoint(), common.fallback()],
                },
              }),
            })
            .build();

          test("not unicode", () => {
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

          test("no hex content", () => {
            expectAccept(lexer, `'\\u{`, {
              data: {
                value: "u{",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "u",
                    error: "unnecessary",
                  },
                ],
                unclosed: true,
              },
            });
          });

          test("invalid hex", () => {
            expectAccept(lexer, `'\\u{ffffff`, {
              data: {
                value: "u{ffffff",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "u",
                    error: "unnecessary",
                  },
                ],
                unclosed: true,
              },
            });
          });

          test("missing suffix", () => {
            expectAccept(lexer, `'\\u{ff`, {
              data: {
                value: "u{ff",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "u",
                    error: "unnecessary",
                  },
                ],
                unclosed: true,
              },
            });
          });

          test("correct", () => {
            expectAccept(lexer, `'\\u{1234}'`, {
              data: {
                value: "\u{1234}",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 8,
                    value: "\u{1234}",
                  },
                ],
              },
            });
          });
        });

        describe("custom error", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.codepoint({ error: "codepoint" }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

          describe("no hex content", () => {
            test("has suffix", () => {
              expectAccept(lexer, `'\\u{}'`, {
                data: {
                  value: "",
                  escapes: [
                    {
                      starter: {
                        index: 1,
                        length: 1,
                      },
                      length: 4,
                      value: "",
                      error: "codepoint",
                    },
                  ],
                },
              });
            });
            test("no suffix", () => {
              expectAccept(lexer, `'\\u{`, {
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
                      error: "codepoint",
                    },
                  ],
                  unclosed: true,
                },
              });
            });
          });

          describe("invalid hex content", () => {
            test("has suffix", () => {
              expectAccept(lexer, `'\\u{ffffff}'`, {
                data: {
                  value: "ffffff",
                  escapes: [
                    {
                      starter: {
                        index: 1,
                        length: 1,
                      },
                      length: 10,
                      value: "ffffff",
                      error: "codepoint",
                    },
                  ],
                },
              });
            });
            test("no suffix", () => {
              expectAccept(lexer, `'\\u{ffffff`, {
                data: {
                  value: "ffffff",
                  escapes: [
                    {
                      starter: {
                        index: 1,
                        length: 1,
                      },
                      length: 9,
                      value: "ffffff",
                      error: "codepoint",
                    },
                  ],
                  unclosed: true,
                },
              });
            });
          });

          test("no suffix", () => {
            expectAccept(lexer, `'\\u{ff`, {
              data: {
                value: "\u{ff}",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 5,
                    value: "\u{ff}",
                    error: "codepoint",
                  },
                ],
                unclosed: true,
              },
            });
          });
        });

        test("custom prefix/suffix", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.codepoint({ prefix: "^", suffix: "$" }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

          expectAccept(lexer, `'\\^123$'`, {
            data: {
              value: "\u{123}",
              escapes: [
                {
                  starter: {
                    index: 1,
                    length: 1,
                  },
                  length: 6,
                  value: "\u{123}",
                },
              ],
            },
          });
        });

        describe("custom max hex length", () => {
          const lexer = new Lexer.Builder()
            .define({
              string: Lexer.stringLiteral(`'`, {
                escape: {
                  handlers: (common) => [
                    common.codepoint({ maxHexLength: 4 }),
                    common.fallback(),
                  ],
                },
              }),
            })
            .build();

          test("correct", () => {
            expectAccept(lexer, `'\\u{1234}'`, {
              data: {
                value: "\u{1234}",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 8,
                    value: "\u{1234}",
                  },
                ],
              },
            });
          });

          test("incorrect", () => {
            expectAccept(lexer, `'\\u{12345}'`, {
              data: {
                value: "u{12345}",
                escapes: [
                  {
                    starter: {
                      index: 1,
                      length: 1,
                    },
                    length: 2,
                    value: "u",
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
