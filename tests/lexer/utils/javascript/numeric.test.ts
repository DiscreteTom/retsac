import { Lexer } from "../../../../src";

describe("integer literals", () => {
  function expectAccept(
    lexer: Lexer.Lexer<
      {
        kind: "int";
        data: Lexer.javascript.IntegerLiteralData;
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
    expect(token.data.prefix).toBe(overrides.data?.prefix ?? "");
    expect(token.data.suffix).toBe(overrides.data?.suffix ?? "");
    expect(token.data.value).toBe(overrides.data?.value ?? "");
    expect(token.data.separators).toEqual(overrides.data?.separators ?? []);
    expect(token.data.leadingSeparator).toBe(
      overrides.data?.leadingSeparator ?? false,
    );
    expect(token.data.tailingSeparator).toBe(
      overrides.data?.tailingSeparator ?? false,
    );
    expect(token.data.consecutiveSeparatorIndexes).toEqual(
      overrides.data?.consecutiveSeparatorIndexes ?? [],
    );
  }

  function expectReject(
    lexer: Lexer.Lexer<
      {
        kind: "int";
        data: Lexer.javascript.IntegerLiteralData;
      },
      never,
      never
    >,
    input: string,
  ) {
    expect(lexer.reset().lex(input)).toBe(null);
  }

  describe("binaryIntegerLiteral", () => {
    describe("default", () => {
      const lexer = new Lexer.Builder()
        .define({ int: Lexer.javascript.binaryIntegerLiteral() })
        .build();

      test("not binary literal", () => {
        expectReject(lexer, "0x1");
      });

      test("only prefix", () => {
        expectAccept(lexer, "0b", {
          data: {
            prefix: "0b",
            suffix: "",
            value: "",
            separators: [],
          },
        });
      });

      test("with content", () => {
        expectAccept(lexer, "0b101", {
          data: {
            prefix: "0b",
            suffix: "",
            value: "101",
            separators: [],
          },
        });
      });

      test("with separators", () => {
        expectAccept(lexer, "0b1_0_1", {
          data: {
            prefix: "0b",
            suffix: "",
            value: "101",
            separators: [
              { index: 3, content: "_" },
              { index: 5, content: "_" },
            ],
          },
        });
      });

      test("with suffix", () => {
        expectAccept(lexer, "0b101n", {
          data: {
            prefix: "0b",
            suffix: "n",
            value: "101",
            separators: [],
          },
        });
      });

      test("with separators and suffix", () => {
        expectAccept(lexer, "0b1_0_1n", {
          data: {
            prefix: "0b",
            suffix: "n",
            value: "101",
            separators: [
              { index: 3, content: "_" },
              { index: 5, content: "_" },
            ],
          },
        });
      });

      test("leading separator", () => {
        expectAccept(lexer, "0b_101", {
          data: {
            prefix: "0b",
            suffix: "",
            value: "101",
            separators: [{ index: 2, content: "_" }],
            leadingSeparator: true,
          },
        });
      });

      test("tailing separator", () => {
        expectAccept(lexer, "0b101_", {
          data: {
            prefix: "0b",
            suffix: "",
            value: "101",
            separators: [{ index: 5, content: "_" }],
            tailingSeparator: true,
          },
        });
      });

      test("consecutive separators", () => {
        expectAccept(lexer, "0b1__01", {
          data: {
            prefix: "0b",
            suffix: "",
            value: "101",
            separators: [
              { index: 3, content: "_" },
              { index: 4, content: "_" },
            ],
            consecutiveSeparatorIndexes: [4],
          },
        });
      });
    });

    describe("reject invalid", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.javascript.binaryIntegerLiteral({ acceptInvalid: false }),
        })
        .build();

      test("leading separator", () => {
        expectReject(lexer, "0b_101");
      });

      test("tailing separator", () => {
        expectReject(lexer, "0b101_");
      });

      test("consecutive separators", () => {
        expectReject(lexer, "0b1__01");
      });

      test("no value", () => {
        expectReject(lexer, "0b");
        expectReject(lexer, "0b_");
        expectReject(lexer, "0bn");
        expectReject(lexer, "0b_n");
      });
    });
  });

  describe("octalIntegerLiteral", () => {
    describe("default", () => {
      const lexer = new Lexer.Builder()
        .define({ int: Lexer.javascript.octalIntegerLiteral() })
        .build();

      test("not octal literal", () => {
        expectReject(lexer, "0x1");
      });

      test("only prefix", () => {
        expectAccept(lexer, "0o", {
          data: {
            prefix: "0o",
            suffix: "",
            value: "",
            separators: [],
          },
        });
      });

      test("with content", () => {
        expectAccept(lexer, "0o707", {
          data: {
            prefix: "0o",
            suffix: "",
            value: "707",
            separators: [],
          },
        });
      });

      test("with separators", () => {
        expectAccept(lexer, "0o7_0_7", {
          data: {
            prefix: "0o",
            suffix: "",
            value: "707",
            separators: [
              { index: 3, content: "_" },
              { index: 5, content: "_" },
            ],
          },
        });
      });

      test("with suffix", () => {
        expectAccept(lexer, "0o707n", {
          data: {
            prefix: "0o",
            suffix: "n",
            value: "707",
            separators: [],
          },
        });
      });

      test("with separators and suffix", () => {
        expectAccept(lexer, "0o7_0_7n", {
          data: {
            prefix: "0o",
            suffix: "n",
            value: "707",
            separators: [
              { index: 3, content: "_" },
              { index: 5, content: "_" },
            ],
          },
        });
      });

      test("leading separator", () => {
        expectAccept(lexer, "0o_707", {
          data: {
            prefix: "0o",
            suffix: "",
            value: "707",
            separators: [{ index: 2, content: "_" }],
            leadingSeparator: true,
          },
        });
      });

      test("tailing separator", () => {
        expectAccept(lexer, "0o707_", {
          data: {
            prefix: "0o",
            suffix: "",
            value: "707",
            separators: [{ index: 5, content: "_" }],
            tailingSeparator: true,
          },
        });
      });

      test("consecutive separators", () => {
        expectAccept(lexer, "0o7__07", {
          data: {
            prefix: "0o",
            suffix: "",
            value: "707",
            separators: [
              { index: 3, content: "_" },
              { index: 4, content: "_" },
            ],
            consecutiveSeparatorIndexes: [4],
          },
        });
      });
    });

    describe("reject invalid", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.javascript.binaryIntegerLiteral({ acceptInvalid: false }),
        })
        .build();

      test("leading separator", () => {
        expectReject(lexer, "0o_707");
      });

      test("tailing separator", () => {
        expectReject(lexer, "0o707_");
      });

      test("consecutive separators", () => {
        expectReject(lexer, "0o7__07");
      });

      test("no value", () => {
        expectReject(lexer, "0o");
        expectReject(lexer, "0o_");
        expectReject(lexer, "0on");
        expectReject(lexer, "0o_n");
      });
    });
  });

  describe("hexIntegerLiteral", () => {
    describe("default", () => {
      const lexer = new Lexer.Builder()
        .define({ int: Lexer.javascript.hexIntegerLiteral() })
        .build();

      test("not hex literal", () => {
        expectReject(lexer, "0b1");
      });

      test("only prefix", () => {
        expectAccept(lexer, "0x", {
          data: {
            prefix: "0x",
            suffix: "",
            value: "",
            separators: [],
          },
        });
      });

      test("with content", () => {
        expectAccept(lexer, "0xF0F", {
          data: {
            prefix: "0x",
            suffix: "",
            value: "F0F",
            separators: [],
          },
        });
      });

      test("with separators", () => {
        expectAccept(lexer, "0xF_0_F", {
          data: {
            prefix: "0x",
            suffix: "",
            value: "F0F",
            separators: [
              { index: 3, content: "_" },
              { index: 5, content: "_" },
            ],
          },
        });
      });

      test("with suffix", () => {
        expectAccept(lexer, "0xF0Fn", {
          data: {
            prefix: "0x",
            suffix: "n",
            value: "F0F",
            separators: [],
          },
        });
      });

      test("with separators and suffix", () => {
        expectAccept(lexer, "0xF_0_Fn", {
          data: {
            prefix: "0x",
            suffix: "n",
            value: "F0F",
            separators: [
              { index: 3, content: "_" },
              { index: 5, content: "_" },
            ],
          },
        });
      });

      test("leading separator", () => {
        expectAccept(lexer, "0x_F0F", {
          data: {
            prefix: "0x",
            suffix: "",
            value: "F0F",
            separators: [{ index: 2, content: "_" }],
            leadingSeparator: true,
          },
        });
      });

      test("tailing separator", () => {
        expectAccept(lexer, "0xF0F_", {
          data: {
            prefix: "0x",
            suffix: "",
            value: "F0F",
            separators: [{ index: 5, content: "_" }],
            tailingSeparator: true,
          },
        });
      });

      test("consecutive separators", () => {
        expectAccept(lexer, "0xF__0F", {
          data: {
            prefix: "0x",
            suffix: "",
            value: "F0F",
            separators: [
              { index: 3, content: "_" },
              { index: 4, content: "_" },
            ],
            consecutiveSeparatorIndexes: [4],
          },
        });
      });
    });

    describe("reject invalid", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.javascript.binaryIntegerLiteral({ acceptInvalid: false }),
        })
        .build();

      test("leading separator", () => {
        expectReject(lexer, "0x_F0F");
      });

      test("tailing separator", () => {
        expectReject(lexer, "0xF0F_");
      });

      test("consecutive separators", () => {
        expectReject(lexer, "0xF__0F");
      });

      test("no value", () => {
        expectReject(lexer, "0x");
        expectReject(lexer, "0x_");
        expectReject(lexer, "0xn");
        expectReject(lexer, "0x_n");
      });
    });
  });
});

describe("numericLiteral", () => {
  function expectAccept(
    lexer: Lexer.Lexer<
      {
        kind: "number";
        data: Lexer.javascript.NumericLiteralData;
      },
      never,
      never
    >,
    input: string,
    overrides: Partial<
      Omit<NonNullable<ReturnType<typeof lexer.lex>>, "data">
    > & {
      data: Partial<NonNullable<ReturnType<typeof lexer.lex>>["data"]> &
        Pick<NonNullable<ReturnType<typeof lexer.lex>>["data"], "integer">;
    },
  ) {
    const token = lexer.reset().lex(input)!;
    expect(token.content).toBe(overrides?.content ?? input);
    expect(token.kind).toBe("number");
    expect(token.error).toBe(undefined);
    expect(token.data.integer).toEqual(overrides.data.integer);
    expect(token.data.fraction).toEqual(overrides.data.fraction ?? undefined);
    expect(token.data.exponent).toEqual(overrides.data.exponent ?? undefined);
    expect(token.data.suffix).toBe(overrides.data.suffix ?? "");
    expect(token.data.separators).toEqual(overrides.data.separators ?? []);
    expect(token.data.emptyExponent).toBe(
      overrides.data.emptyExponent ?? false,
    );
    expect(token.data.leadingZero).toBe(overrides.data.leadingZero ?? false);
    expect(token.data.bigIntWithFraction).toBe(
      overrides.data.bigIntWithFraction ?? false,
    );
    expect(token.data.bigIntWithExponent).toBe(
      overrides.data.bigIntWithExponent ?? false,
    );
    expect(token.data.missingBoundary).toBe(
      overrides.data.missingBoundary ?? false,
    );
    expect(token.data.invalidSeparatorIndexes).toEqual(
      overrides.data.invalidSeparatorIndexes ?? [],
    );
    expect(token.data.consecutiveSeparatorIndexes).toEqual(
      overrides.data.consecutiveSeparatorIndexes ?? [],
    );
  }

  function expectReject(
    lexer: Lexer.Lexer<
      {
        kind: "number";
        data: Lexer.javascript.NumericLiteralData;
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
      .define({ number: Lexer.javascript.numericLiteral() })
      .build();

    test("not numeric literal", () => {
      expectReject(lexer, "abc");
    });

    test("integer only", () => {
      expectAccept(lexer, "123", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
        },
      });
    });

    test("integer with prefix", () => {
      expectAccept(lexer, "+123", {
        data: {
          prefix: "+",
          integer: {
            index: 1,
            digested: 3,
            value: "123",
          },
        },
      });
      expectAccept(lexer, "-123", {
        data: {
          prefix: "-",
          integer: {
            index: 1,
            digested: 3,
            value: "123",
          },
        },
      });
      expectAccept(lexer, "- 123", {
        data: {
          prefix: "- ",
          integer: {
            index: 2,
            digested: 3,
            value: "123",
          },
        },
      });
    });

    test("integer with separators", () => {
      expectAccept(lexer, "1_2_3", {
        data: {
          integer: {
            index: 0,
            digested: 5,
            value: "123",
          },
          separators: [
            { index: 1, content: "_" },
            { index: 3, content: "_" },
          ],
        },
      });
    });

    test("integer with suffix", () => {
      expectAccept(lexer, "123n", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          suffix: "n",
        },
      });
    });

    test("integer and fraction", () => {
      expectAccept(lexer, "123.456", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          fraction: {
            point: {
              index: 3,
              content: ".",
            },
            index: 4,
            digested: 3,
            value: "456",
          },
        },
      });
    });

    test("fraction only", () => {
      expectAccept(lexer, ".456", {
        data: {
          integer: {
            index: 0,
            digested: 0,
            value: "",
          },
          fraction: {
            point: {
              index: 0,
              content: ".",
            },
            index: 1,
            digested: 3,
            value: "456",
          },
        },
      });
    });

    test("integer and fraction with separator", () => {
      expectAccept(lexer, "1_2_3.4_5_6", {
        data: {
          integer: {
            index: 0,
            digested: 5,
            value: "123",
          },
          fraction: {
            point: {
              index: 5,
              content: ".",
            },
            index: 6,
            digested: 5,
            value: "456",
          },
          separators: [
            { index: 1, content: "_" },
            { index: 3, content: "_" },
            { index: 7, content: "_" },
            { index: 9, content: "_" },
          ],
        },
      });
    });

    test("fraction with separator", () => {
      expectAccept(lexer, ".4_5_6", {
        data: {
          integer: {
            index: 0,
            digested: 0,
            value: "",
          },
          fraction: {
            point: {
              index: 0,
              content: ".",
            },
            index: 1,
            digested: 5,
            value: "456",
          },
          separators: [
            { index: 2, content: "_" },
            { index: 4, content: "_" },
          ],
        },
      });
    });

    test("fraction with suffix", () => {
      expectAccept(lexer, ".456n", {
        data: {
          integer: {
            index: 0,
            digested: 0,
            value: "",
          },
          fraction: {
            point: {
              index: 0,
              content: ".",
            },
            index: 1,
            digested: 3,
            value: "456",
          },
          suffix: "n",
          bigIntWithFraction: true,
        },
      });
    });

    test("integer and exponent", () => {
      expectAccept(lexer, "123e456", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 3,
            value: "456",
          },
        },
      });
      expectAccept(lexer, "123E456", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "E",
            },
            index: 4,
            digested: 3,
            value: "456",
          },
        },
      });
    });

    test("fraction and exponent", () => {
      expectAccept(lexer, "123.456e789", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          fraction: {
            point: {
              index: 3,
              content: ".",
            },
            index: 4,
            digested: 3,
            value: "456",
          },
          exponent: {
            indicator: {
              index: 7,
              content: "e",
            },
            index: 8,
            digested: 3,
            value: "789",
          },
        },
      });
    });

    test("exponent with sign", () => {
      expectAccept(lexer, "123e+456", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e+",
            },
            index: 5,
            digested: 3,
            value: "456",
          },
        },
      });
      expectAccept(lexer, "123e-456", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e-",
            },
            index: 5,
            digested: 3,
            value: "456",
          },
        },
      });
    });

    test("exponent with suffix", () => {
      expectAccept(lexer, "123e456n", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 3,
            value: "456",
          },
          suffix: "n",
          bigIntWithExponent: true,
        },
      });
    });

    test("exponent with separator", () => {
      expectAccept(lexer, "123e4_5_6", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 5,
            value: "456",
          },
          separators: [
            { index: 5, content: "_" },
            { index: 7, content: "_" },
          ],
        },
      });
    });

    test("empty exponent", () => {
      expectAccept(lexer, "123e", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 0,
            value: "",
          },
          emptyExponent: true,
        },
      });
    });

    test("leading zero", () => {
      expectAccept(lexer, "0123", {
        data: {
          integer: {
            index: 0,
            digested: 4,
            value: "0123",
          },
          leadingZero: true,
        },
      });
    });

    test("big int with fraction", () => {
      expectAccept(lexer, "123.456n", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          fraction: {
            point: {
              index: 3,
              content: ".",
            },
            index: 4,
            digested: 3,
            value: "456",
          },
          suffix: "n",
          bigIntWithFraction: true,
        },
      });
    });

    test("big int with exponent", () => {
      expectAccept(lexer, "123e456n", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 3,
            value: "456",
          },
          suffix: "n",
          bigIntWithExponent: true,
        },
      });
    });

    test("missing boundary", () => {
      expectAccept(lexer, "123abc", {
        content: "123",
        data: {
          integer: {
            index: 0,
            digested: 3,
            value: "123",
          },
          missingBoundary: true,
        },
      });
    });

    describe("invalid separators", () => {
      test("starts with 0_", () => {
        expectAccept(lexer, "0_123", {
          data: {
            integer: {
              index: 0,
              digested: 5,
              value: "0123",
            },
            separators: [{ index: 1, content: "_" }],
            invalidSeparatorIndexes: [1],
            leadingZero: true,
          },
        });
      });

      test("separator should not be at start or end of each part", () => {
        expectAccept(lexer, "_1_._1_e_1_n", {
          data: {
            integer: {
              index: 0,
              digested: 3,
              value: "1",
            },
            fraction: {
              point: {
                index: 3,
                content: ".",
              },
              index: 4,
              digested: 3,
              value: "1",
            },
            exponent: {
              indicator: {
                index: 7,
                content: "e",
              },
              index: 8,
              digested: 3,
              value: "1",
            },
            suffix: "n",
            separators: [
              { index: 0, content: "_" },
              { index: 2, content: "_" },
              { index: 4, content: "_" },
              { index: 6, content: "_" },
              { index: 8, content: "_" },
              { index: 10, content: "_" },
            ],
            invalidSeparatorIndexes: [0, 2, 4, 6, 8, 10],
            bigIntWithFraction: true,
            bigIntWithExponent: true,
          },
        });
      });
    });

    test("consecutive separators", () => {
      expectAccept(lexer, "1__2__3", {
        data: {
          integer: {
            index: 0,
            digested: 7,
            value: "123",
          },
          separators: [
            { index: 1, content: "_" },
            { index: 2, content: "_" },
            { index: 4, content: "_" },
            { index: 5, content: "_" },
          ],
          consecutiveSeparatorIndexes: [2, 5],
        },
      });
    });
  });

  describe("reject invalid", () => {
    describe("require boundary", () => {
      const lexer = new Lexer.Builder()
        .define({
          number: Lexer.javascript.numericLiteral({ acceptInvalid: false }),
        })
        .build();

      test("missing boundary", () => {
        expectReject(lexer, "123abc");
      });

      test("empty exponent", () => {
        expectReject(lexer, "123e");
      });

      test("leading zero", () => {
        expectReject(lexer, "0123");
      });

      test("big int with fraction", () => {
        expectReject(lexer, "123.456n");
      });

      test("big int with exponent", () => {
        expectReject(lexer, "123e456n");
      });

      test("invalid separators", () => {
        expectReject(lexer, "0_123");
        expectReject(lexer, "_1_._1_e_1_n");
      });

      test("consecutive separators", () => {
        expectReject(lexer, "1__2__3");
      });
    });

    describe("don't require boundary", () => {
      const lexer = new Lexer.Builder()
        .define({
          number: Lexer.javascript.numericLiteral({
            acceptInvalid: false,
            boundary: false,
          }),
        })
        .build();

      test("missing boundary", () => {
        expectAccept(lexer, "123abc", {
          content: "123",
          data: {
            integer: {
              index: 0,
              digested: 3,
              value: "123",
            },
            missingBoundary: true,
          },
        });
      });
    });
  });
});
