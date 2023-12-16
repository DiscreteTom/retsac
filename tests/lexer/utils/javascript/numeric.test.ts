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
