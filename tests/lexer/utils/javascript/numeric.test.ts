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
      Omit<NonNullable<ReturnType<typeof lexer.lex>["token"]>, "data">
    > & {
      data: Partial<
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
    expect(token.kind).toBe("int");
    expect(token.error).toBe(undefined);
    expect(token.data.prefix).toBe(overrides.data?.prefix ?? "");
    expect(token.data.suffix).toBe(overrides.data?.suffix ?? "");
    expect(token.data.value).toBe(overrides.data?.value ?? eval(input));
    expect(token.data.separators).toEqual(overrides.data?.separators ?? []);
    if (token.data.invalid !== undefined) {
      expect(token.data.invalid.emptyContent).toBe(
        overrides.data?.invalid?.emptyContent ?? false,
      );
      expect(token.data.invalid.consecutiveSeparatorIndexes).toEqual(
        overrides.data?.invalid?.consecutiveSeparatorIndexes ?? [],
      );
      expect(token.data.invalid.tailingSeparator).toBe(
        overrides.data?.invalid?.tailingSeparator ?? false,
      );
      expect(token.data.invalid.leadingSeparator).toBe(
        overrides.data?.invalid?.leadingSeparator ?? false,
      );
    }
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
    expect(lexer.reload(input).lex().token).toBe(undefined);
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
            value: 0,
            prefix: "0b",
            suffix: "",
            body: "",
            separators: [],
            invalid: {
              emptyContent: true,
            },
          },
        });
      });

      test("with content", () => {
        expectAccept(lexer, "0b101", {
          data: {
            prefix: "0b",
            suffix: "",
            body: "101",
            separators: [],
          },
        });
      });

      test("with separators", () => {
        expectAccept(lexer, "0b1_0_1", {
          data: {
            prefix: "0b",
            suffix: "",
            body: "101",
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
            body: "101",
            separators: [],
          },
        });
      });

      test("with separators and suffix", () => {
        expectAccept(lexer, "0b1_0_1n", {
          data: {
            prefix: "0b",
            suffix: "n",
            body: "101",
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
            value: 0b101,
            prefix: "0b",
            suffix: "",
            body: "101",
            separators: [{ index: 2, content: "_" }],
            invalid: {
              leadingSeparator: true,
            },
          },
        });
      });

      test("tailing separator", () => {
        expectAccept(lexer, "0b101_", {
          data: {
            value: 0b101,
            prefix: "0b",
            suffix: "",
            body: "101",
            separators: [{ index: 5, content: "_" }],
            invalid: {
              tailingSeparator: true,
            },
          },
        });
      });

      test("consecutive separators", () => {
        expectAccept(lexer, "0b1__01", {
          data: {
            value: 0b101,
            prefix: "0b",
            suffix: "",
            body: "101",
            separators: [
              { index: 3, content: "_" },
              { index: 4, content: "_" },
            ],
            invalid: {
              consecutiveSeparatorIndexes: [4],
            },
          },
        });
      });
    });

    describe("reject invalid", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.javascript
            .binaryIntegerLiteral()
            .reject(Lexer.invalidRejecter),
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
            value: 0,
            prefix: "0o",
            suffix: "",
            body: "",
            separators: [],
            invalid: {
              emptyContent: true,
            },
          },
        });
      });

      test("with content", () => {
        expectAccept(lexer, "0o707", {
          data: {
            prefix: "0o",
            suffix: "",
            body: "707",
            separators: [],
          },
        });
      });

      test("with separators", () => {
        expectAccept(lexer, "0o7_0_7", {
          data: {
            prefix: "0o",
            suffix: "",
            body: "707",
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
            body: "707",
            separators: [],
          },
        });
      });

      test("with separators and suffix", () => {
        expectAccept(lexer, "0o7_0_7n", {
          data: {
            prefix: "0o",
            suffix: "n",
            body: "707",
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
            value: 0o707,
            prefix: "0o",
            suffix: "",
            body: "707",
            separators: [{ index: 2, content: "_" }],
            invalid: {
              leadingSeparator: true,
            },
          },
        });
      });

      test("tailing separator", () => {
        expectAccept(lexer, "0o707_", {
          data: {
            value: 0o707,
            prefix: "0o",
            suffix: "",
            body: "707",
            separators: [{ index: 5, content: "_" }],
            invalid: {
              tailingSeparator: true,
            },
          },
        });
      });

      test("consecutive separators", () => {
        expectAccept(lexer, "0o7__07", {
          data: {
            value: 0o707,
            prefix: "0o",
            suffix: "",
            body: "707",
            separators: [
              { index: 3, content: "_" },
              { index: 4, content: "_" },
            ],
            invalid: {
              consecutiveSeparatorIndexes: [4],
            },
          },
        });
      });
    });

    describe("reject invalid", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.javascript
            .binaryIntegerLiteral()
            .reject(Lexer.invalidRejecter),
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
            value: 0,
            prefix: "0x",
            suffix: "",
            body: "",
            separators: [],
            invalid: {
              emptyContent: true,
            },
          },
        });
      });

      test("with content", () => {
        expectAccept(lexer, "0xF0F", {
          data: {
            prefix: "0x",
            suffix: "",
            body: "F0F",
            separators: [],
          },
        });
      });

      test("with separators", () => {
        expectAccept(lexer, "0xF_0_F", {
          data: {
            prefix: "0x",
            suffix: "",
            body: "F0F",
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
            body: "F0F",
            separators: [],
          },
        });
      });

      test("with separators and suffix", () => {
        expectAccept(lexer, "0xF_0_Fn", {
          data: {
            prefix: "0x",
            suffix: "n",
            body: "F0F",
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
            value: 0xf0f,
            prefix: "0x",
            suffix: "",
            body: "F0F",
            separators: [{ index: 2, content: "_" }],
            invalid: {
              leadingSeparator: true,
            },
          },
        });
      });

      test("tailing separator", () => {
        expectAccept(lexer, "0xF0F_", {
          data: {
            value: 0xf0f,
            prefix: "0x",
            suffix: "",
            body: "F0F",
            separators: [{ index: 5, content: "_" }],
            invalid: {
              tailingSeparator: true,
            },
          },
        });
      });

      test("consecutive separators", () => {
        expectAccept(lexer, "0xF__0F", {
          data: {
            value: 0xf0f,
            prefix: "0x",
            suffix: "",
            body: "F0F",
            separators: [
              { index: 3, content: "_" },
              { index: 4, content: "_" },
            ],
            invalid: {
              consecutiveSeparatorIndexes: [4],
            },
          },
        });
      });
    });

    describe("reject invalid", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.javascript
            .binaryIntegerLiteral()
            .reject(Lexer.invalidRejecter),
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
      Omit<NonNullable<ReturnType<typeof lexer.lex>["token"]>, "data">
    > & {
      data: Partial<
        Omit<
          NonNullable<ReturnType<typeof lexer.lex>["token"]>["data"],
          "invalid"
        >
      > &
        Pick<
          NonNullable<ReturnType<typeof lexer.lex>["token"]>["data"],
          "integer"
        > & {
          invalid?: Partial<
            NonNullable<
              ReturnType<typeof lexer.lex>["token"]
            >["data"]["invalid"]
          >;
        };
    },
  ) {
    const token = lexer.reload(input).lex().token!;
    expect(token.content).toBe(overrides?.content ?? input);
    expect(token.kind).toBe("number");
    expect(token.error).toBe(undefined);
    expect(token.data.integer).toEqual(overrides.data.integer);
    expect(token.data.fraction).toEqual(overrides.data.fraction ?? undefined);
    expect(token.data.exponent).toEqual(overrides.data.exponent ?? undefined);
    expect(token.data.suffix).toBe(overrides.data.suffix ?? "");
    expect(token.data.separators).toEqual(overrides.data.separators ?? []);
    if (token.data.invalid !== undefined) {
      expect(token.data.invalid.emptyExponent).toBe(
        overrides.data.invalid?.emptyExponent ?? false,
      );
      expect(token.data.invalid.leadingZero).toBe(
        overrides.data.invalid?.leadingZero ?? false,
      );
      expect(token.data.invalid.bigIntWithFraction).toBe(
        overrides.data.invalid?.bigIntWithFraction ?? false,
      );
      expect(token.data.invalid.bigIntWithExponent).toBe(
        overrides.data.invalid?.bigIntWithExponent ?? false,
      );
      expect(token.data.invalid.missingBoundary).toBe(
        overrides.data.invalid?.missingBoundary ?? false,
      );
      expect(token.data.invalid.invalidSeparatorIndexes).toEqual(
        overrides.data.invalid?.invalidSeparatorIndexes ?? [],
      );
      expect(token.data.invalid.consecutiveSeparatorIndexes).toEqual(
        overrides.data.invalid?.consecutiveSeparatorIndexes ?? [],
      );
    }
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
    expect(lexer.reload(input).lex().token).toBe(undefined);
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
            body: "123",
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
            body: "123",
          },
        },
      });
      expectAccept(lexer, "-123", {
        data: {
          prefix: "-",
          integer: {
            index: 1,
            digested: 3,
            body: "123",
          },
        },
      });
      expectAccept(lexer, "- 123", {
        data: {
          prefix: "- ",
          integer: {
            index: 2,
            digested: 3,
            body: "123",
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
            body: "123",
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
            body: "123",
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
            body: "123",
          },
          fraction: {
            point: {
              index: 3,
              content: ".",
            },
            index: 4,
            digested: 3,
            body: "456",
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
            body: "",
          },
          fraction: {
            point: {
              index: 0,
              content: ".",
            },
            index: 1,
            digested: 3,
            body: "456",
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
            body: "123",
          },
          fraction: {
            point: {
              index: 5,
              content: ".",
            },
            index: 6,
            digested: 5,
            body: "456",
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
            body: "",
          },
          fraction: {
            point: {
              index: 0,
              content: ".",
            },
            index: 1,
            digested: 5,
            body: "456",
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
            body: "",
          },
          fraction: {
            point: {
              index: 0,
              content: ".",
            },
            index: 1,
            digested: 3,
            body: "456",
          },
          suffix: "n",
          invalid: {
            bigIntWithFraction: true,
          },
        },
      });
    });

    test("integer and exponent", () => {
      expectAccept(lexer, "123e456", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            body: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 3,
            body: "456",
          },
        },
      });
      expectAccept(lexer, "123E456", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            body: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "E",
            },
            index: 4,
            digested: 3,
            body: "456",
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
            body: "123",
          },
          fraction: {
            point: {
              index: 3,
              content: ".",
            },
            index: 4,
            digested: 3,
            body: "456",
          },
          exponent: {
            indicator: {
              index: 7,
              content: "e",
            },
            index: 8,
            digested: 3,
            body: "789",
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
            body: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e+",
            },
            index: 5,
            digested: 3,
            body: "456",
          },
        },
      });
      expectAccept(lexer, "123e-456", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            body: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e-",
            },
            index: 5,
            digested: 3,
            body: "456",
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
            body: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 3,
            body: "456",
          },
          suffix: "n",
          invalid: {
            bigIntWithExponent: true,
          },
        },
      });
    });

    test("exponent with separator", () => {
      expectAccept(lexer, "123e4_5_6", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            body: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 5,
            body: "456",
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
            body: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 0,
            body: "",
          },
          invalid: {
            emptyExponent: true,
          },
        },
      });
    });

    test("leading zero", () => {
      expectAccept(lexer, "0123", {
        data: {
          integer: {
            index: 0,
            digested: 4,
            body: "0123",
          },
          invalid: {
            leadingZero: true,
          },
        },
      });
    });

    test("big int with fraction", () => {
      expectAccept(lexer, "123.456n", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            body: "123",
          },
          fraction: {
            point: {
              index: 3,
              content: ".",
            },
            index: 4,
            digested: 3,
            body: "456",
          },
          suffix: "n",
          invalid: {
            bigIntWithFraction: true,
          },
        },
      });
    });

    test("big int with exponent", () => {
      expectAccept(lexer, "123e456n", {
        data: {
          integer: {
            index: 0,
            digested: 3,
            body: "123",
          },
          exponent: {
            indicator: {
              index: 3,
              content: "e",
            },
            index: 4,
            digested: 3,
            body: "456",
          },
          suffix: "n",
          invalid: {
            bigIntWithExponent: true,
          },
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
            body: "123",
          },
          invalid: {
            missingBoundary: true,
          },
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
              body: "0123",
            },
            separators: [{ index: 1, content: "_" }],
            invalid: {
              invalidSeparatorIndexes: [1],
              leadingZero: true,
            },
          },
        });
      });

      test("separator should not be at start or end of each part", () => {
        expectAccept(lexer, "_1_._1_e_1_n", {
          data: {
            integer: {
              index: 0,
              digested: 3,
              body: "1",
            },
            fraction: {
              point: {
                index: 3,
                content: ".",
              },
              index: 4,
              digested: 3,
              body: "1",
            },
            exponent: {
              indicator: {
                index: 7,
                content: "e",
              },
              index: 8,
              digested: 3,
              body: "1",
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
            invalid: {
              invalidSeparatorIndexes: [0, 2, 4, 6, 8, 10],
              bigIntWithFraction: true,
              bigIntWithExponent: true,
            },
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
            body: "123",
          },
          separators: [
            { index: 1, content: "_" },
            { index: 2, content: "_" },
            { index: 4, content: "_" },
            { index: 5, content: "_" },
          ],
          invalid: {
            consecutiveSeparatorIndexes: [2, 5],
          },
        },
      });
    });
  });

  describe("reject invalid", () => {
    describe("require boundary", () => {
      const lexer = new Lexer.Builder()
        .define({
          number: Lexer.javascript
            .numericLiteral()
            .reject(Lexer.invalidRejecter),
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
          number: Lexer.javascript.numericLiteral(),
        })
        .build();

      test("missing boundary", () => {
        expectAccept(lexer, "123abc", {
          content: "123",
          data: {
            integer: {
              index: 0,
              digested: 3,
              body: "123",
            },
            invalid: {
              missingBoundary: true,
            },
          },
        });
      });
    });
  });
});
