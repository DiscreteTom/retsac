import { Lexer } from "../../../../src";

function expectReject(
  lexer: Lexer.Lexer<
    {
      kind: "number";
      data: unknown;
    },
    never,
    never
  >,
  input: string,
) {
  expect(lexer.reload(input).lex().token).toBe(undefined);
}

describe("numericLiteral", () => {
  function expectAccept(
    lexer: Lexer.Lexer<
      {
        kind: "number";
        data: Lexer.json.NumericLiteralData;
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
      expect(token.data.invalid.emptyInteger).toBe(
        overrides.data.invalid?.emptyInteger ?? false,
      );
      expect(token.data.invalid.emptyFraction).toBe(
        overrides.data.invalid?.emptyFraction ?? false,
      );
      expect(token.data.invalid.emptyExponent).toBe(
        overrides.data.invalid?.emptyExponent ?? false,
      );
      expect(token.data.invalid.leadingZero).toBe(
        overrides.data.invalid?.leadingZero ?? false,
      );
    }
  }

  describe("default", () => {
    const lexer = new Lexer.Builder()
      .define({ number: Lexer.json.numericLiteral() })
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
          invalid: {
            emptyInteger: true,
          },
        },
      });
    });

    test("empty fraction", () => {
      expectAccept(lexer, "123.", {
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
            digested: 0,
            body: "",
          },
          invalid: {
            emptyFraction: true,
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
  });
});

describe("exactNumericLiteral", () => {
  function expectAccept(
    lexer: Lexer.Lexer<
      {
        kind: "number";
        data: undefined;
      },
      never,
      never
    >,
    input: string,
    overrides?: Partial<
      Omit<NonNullable<ReturnType<typeof lexer.lex>["token"]>, "data">
    >,
  ) {
    const token = lexer.reload(input).lex().token!;
    expect(token.content).toBe(overrides?.content ?? input);
    expect(token.kind).toBe("number");
    expect(token.error).toBe(undefined);
    expect(token.data).toEqual(undefined);
  }

  const lexer = new Lexer.Builder()
    .define({ number: Lexer.json.exactNumericLiteral() })
    .build();

  test("not numeric literal", () => {
    expectReject(lexer, "abc");
  });

  test("integer only", () => {
    expectAccept(lexer, "123");
    expectAccept(lexer, "-123");
  });

  test("integer and fraction", () => {
    expectAccept(lexer, "123.456");
    expectAccept(lexer, "-123.456");
  });

  test("integer and exponent", () => {
    expectAccept(lexer, "123e456");
    expectAccept(lexer, "-123e456");
    expectAccept(lexer, "123E456");
    expectAccept(lexer, "-123E456");
    expectAccept(lexer, "123e+456");
    expectAccept(lexer, "-123e+456");
    expectAccept(lexer, "123e-456");
    expectAccept(lexer, "-123e-456");
  });

  test("all together", () => {
    expectAccept(lexer, "123.456e789");
    expectAccept(lexer, "-123.456e789");
    expectAccept(lexer, "123.456e+789");
    expectAccept(lexer, "-123.456e+789");
    expectAccept(lexer, "123.456e-789");
    expectAccept(lexer, "-123.456e-789");
  });

  describe("invalid", () => {
    test("leading zero", () => {
      expectAccept(lexer, "0123", { content: "0" });
      expectAccept(lexer, "-0123", { content: "-0" });
    });

    test("empty integer", () => {
      expectReject(lexer, ".123");
      expectReject(lexer, "-.123");
    });

    test("empty fraction", () => {
      expectAccept(lexer, "123.", { content: "123" });
      expectAccept(lexer, "-123.", { content: "-123" });
    });

    test("empty exponent", () => {
      expectAccept(lexer, "123e", { content: "123" });
      expectAccept(lexer, "-123e", { content: "-123" });
      expectAccept(lexer, "123E+", { content: "123" });
      expectAccept(lexer, "-123E-", { content: "-123" });
    });
  });
});
