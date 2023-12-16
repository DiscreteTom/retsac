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

  describe("binaryIntegerLiteral", () => {
    describe("default", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.binaryIntegerLiteral(),
        })
        .build();

      test("single digit", () => {
        expectAccept(lexer, "0b1", {
          data: {
            prefix: "0b",
            value: "1",
          },
        });
      });
      test("multiple digits", () => {
        expectAccept(lexer, "0b101", {
          data: {
            prefix: "0b",
            value: "101",
          },
        });
      });
      test("separators are disabled by default", () => {
        expectAccept(lexer, "0b1_1", {
          content: "0b1",
          data: {
            prefix: "0b",
            value: "1",
          },
        });
      });
      test("suffix is disabled by default", () => {
        expectAccept(lexer, "0b1n", {
          content: "0b1",
          data: {
            prefix: "0b",
            value: "1",
          },
        });
      });
    });

    describe("custom separator", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.binaryIntegerLiteral({
            separator: "-",
          }),
        })
        .build();

      test("simple", () => {
        expectAccept(lexer, "0b1-1", {
          data: {
            prefix: "0b",
            value: "11",
            separators: [{ index: 3, content: "-" }],
          },
        });
      });
    });

    describe("custom suffix", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.binaryIntegerLiteral({
            suffix: /[if]/,
          }),
        })
        .build();

      test("simple", () => {
        expectAccept(lexer, "0b1i", {
          data: {
            prefix: "0b",
            value: "1",
            suffix: "i",
          },
        });
        expectAccept(lexer, "0b1f", {
          data: {
            prefix: "0b",
            value: "1",
            suffix: "f",
          },
        });
      });
    });
  });

  describe("octalIntegerLiteral", () => {
    describe("default", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.octalIntegerLiteral(),
        })
        .build();

      test("single digit", () => {
        expectAccept(lexer, "0o7", {
          data: {
            prefix: "0o",
            value: "7",
          },
        });
      });
      test("multiple digits", () => {
        expectAccept(lexer, "0o707", {
          data: {
            prefix: "0o",
            value: "707",
          },
        });
      });
      test("separators are disabled by default", () => {
        expectAccept(lexer, "0o7_7", {
          content: "0o7",
          data: {
            prefix: "0o",
            value: "7",
          },
        });
      });
      test("suffix is disabled by default", () => {
        expectAccept(lexer, "0o7n", {
          content: "0o7",
          data: {
            prefix: "0o",
            value: "7",
          },
        });
      });
    });

    describe("custom separator", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.octalIntegerLiteral({
            separator: "-",
          }),
        })
        .build();

      test("simple", () => {
        expectAccept(lexer, "0o7-7", {
          data: {
            prefix: "0o",
            value: "77",
            separators: [{ index: 3, content: "-" }],
          },
        });
      });
    });

    describe("custom suffix", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.octalIntegerLiteral({
            suffix: /[if]/,
          }),
        })
        .build();

      test("simple", () => {
        expectAccept(lexer, "0o7i", {
          data: {
            prefix: "0o",
            value: "7",
            suffix: "i",
          },
        });
        expectAccept(lexer, "0o7f", {
          data: {
            prefix: "0o",
            value: "7",
            suffix: "f",
          },
        });
      });
    });
  });

  describe("hexIntegerLiteral", () => {
    describe("default", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.hexIntegerLiteral(),
        })
        .build();

      test("single digit", () => {
        expectAccept(lexer, "0xF", {
          data: {
            prefix: "0x",
            value: "F",
          },
        });
      });
      test("multiple digits", () => {
        expectAccept(lexer, "0xF0F", {
          data: {
            prefix: "0x",
            value: "F0F",
          },
        });
      });
      test("separators are disabled by default", () => {
        expectAccept(lexer, "0xF_F", {
          content: "0xF",
          data: {
            prefix: "0x",
            value: "F",
          },
        });
      });
      test("suffix is disabled by default", () => {
        expectAccept(lexer, "0xFn", {
          content: "0xF",
          data: {
            prefix: "0x",
            value: "F",
          },
        });
      });
    });

    describe("custom separator", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.hexIntegerLiteral({
            separator: "-",
          }),
        })
        .build();

      test("simple", () => {
        expectAccept(lexer, "0xF-F", {
          data: {
            prefix: "0x",
            value: "FF",
            separators: [{ index: 3, content: "-" }],
          },
        });
      });
    });

    describe("custom suffix", () => {
      const lexer = new Lexer.Builder()
        .define({
          int: Lexer.hexIntegerLiteral({
            suffix: /[ig]/,
          }),
        })
        .build();

      test("simple", () => {
        expectAccept(lexer, "0xFi", {
          data: {
            prefix: "0x",
            value: "F",
            suffix: "i",
          },
        });
        expectAccept(lexer, "0xFg", {
          data: {
            prefix: "0x",
            value: "F",
            suffix: "g",
          },
        });
      });
    });
  });
});

describe("numericLiteral", () => {
  function expectAccept(
    lexer: Lexer.Lexer<
      {
        kind: "number";
        data: Lexer.NumericLiteralData;
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
  }

  function expectReject(
    lexer: Lexer.Lexer<
      {
        kind: "number";
        data: Lexer.NumericLiteralData;
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
      .define({ number: Lexer.numericLiteral() })
      .build();

    describe("simple", () => {
      test("empty input", () => {
        expectReject(lexer, "");
      });
      test("not numeric literal", () => {
        expectReject(lexer, "abc");
      });
      describe("accept", () => {
        test("single digit", () => {
          expectAccept(lexer, "1", {
            data: {
              integer: {
                value: "1",
                digested: 1,
              },
            },
          });
        });
        test("multiple digits", () => {
          expectAccept(lexer, "111", {
            data: {
              integer: {
                value: "111",
                digested: 3,
              },
            },
          });
        });
      });
    });

    describe("separator is disabled by default", () => {
      test("accept", () => {
        expectAccept(lexer, "1_1", {
          content: "1",
          data: {
            integer: {
              value: "1",
              digested: 1,
            },
          },
        });
      });
    });

    describe("no fraction part by default", () => {
      test("accept", () => {
        expectAccept(lexer, "1.", {
          content: "1",
          data: {
            integer: {
              value: "1",
              digested: 1,
            },
          },
        });
      });
    });

    describe("no exponent part by default", () => {
      test("accept", () => {
        expectAccept(lexer, "1e", {
          content: "1",
          data: {
            integer: {
              value: "1",
              digested: 1,
            },
          },
        });
      });
    });

    describe("no suffix by default", () => {
      test("accept", () => {
        expectAccept(lexer, "1n", {
          content: "1",
          data: {
            integer: {
              value: "1",
              digested: 1,
            },
          },
        });
      });
    });
  });

  describe("custom decimal point", () => {
    const lexer = new Lexer.Builder()
      .define({ number: Lexer.numericLiteral({ decimalPoint: "," }) })
      .build();

    test("accept", () => {
      expectAccept(lexer, "1,1", {
        data: {
          integer: {
            value: "1",
            digested: 1,
          },
          fraction: {
            point: {
              index: 1,
              content: ",",
            },
            index: 2,
            value: "1",
            digested: 1,
          },
        },
      });
    });

    test("when multi decimal point, accept the first one", () => {
      expectAccept(lexer, "1,1,1", {
        content: "1,1",
        data: {
          integer: {
            value: "1",
            digested: 1,
          },
          fraction: {
            point: {
              index: 1,
              content: ",",
            },
            index: 2,
            value: "1",
            digested: 1,
          },
        },
      });
    });

    test("reject if all parts are empty", () => {
      expectReject(lexer, ",");
    });
  });

  describe("custom exponent indicator", () => {
    const lexer = new Lexer.Builder()
      .define({ number: Lexer.numericLiteral({ exponentIndicator: "e" }) })
      .build();

    test("accept", () => {
      expectAccept(lexer, "1e1", {
        data: {
          integer: {
            value: "1",
            digested: 1,
          },
          exponent: {
            indicator: {
              index: 1,
              content: "e",
            },
            index: 2,
            value: "1",
            digested: 1,
          },
        },
      });
    });

    test("when multi exponent indicator, accept the first one", () => {
      expectAccept(lexer, "1e1e1", {
        content: "1e1",
        data: {
          integer: {
            value: "1",
            digested: 1,
          },
          exponent: {
            indicator: {
              index: 1,
              content: "e",
            },
            index: 2,
            value: "1",
            digested: 1,
          },
        },
      });
    });

    test("reject if all parts are empty", () => {
      expectReject(lexer, "e");
    });
  });

  describe("custom separator", () => {
    const lexer = new Lexer.Builder()
      .define({ number: Lexer.numericLiteral({ separator: "-" }) })
      .build();

    test("accept", () => {
      expectAccept(lexer, "1-1", {
        data: {
          integer: {
            value: "11",
            digested: 3,
          },
          separators: [{ index: 1, content: "-" }],
        },
      });
    });

    test("multi separator", () => {
      expectAccept(lexer, "1-1-1", {
        data: {
          integer: {
            value: "111",
            digested: 5,
          },
          separators: [
            { index: 1, content: "-" },
            { index: 3, content: "-" },
          ],
        },
      });
    });

    test("separators only, reject because all parts are empty", () => {
      expectReject(lexer, "--");
    });
  });

  describe("custom suffix", () => {
    const lexer = new Lexer.Builder()
      .define({ number: Lexer.numericLiteral({ suffix: /[if]/ }) })
      .build();

    test("accept", () => {
      expectAccept(lexer, "1i", {
        data: {
          integer: {
            value: "1",
            digested: 1,
          },
          suffix: "i",
        },
      });
      expectAccept(lexer, "1f", {
        data: {
          integer: {
            value: "1",
            digested: 1,
          },
          suffix: "f",
        },
      });
    });
  });

  describe("fully customized", () => {
    const lexer = new Lexer.Builder()
      .define({
        number: Lexer.numericLiteral({
          decimalPoint: ",",
          exponentIndicator: "e",
          separator: "-",
          suffix: /[if]/,
        }),
      })
      .build();

    test("accept", () => {
      expectAccept(lexer, "1-1,1-1e1-1i", {
        data: {
          integer: {
            value: "11",
            digested: 3,
          },
          fraction: {
            point: {
              index: 3,
              content: ",",
            },
            index: 4,
            value: "11",
            digested: 3,
          },
          exponent: {
            indicator: {
              index: 8,
              content: "e",
            },
            index: 9,
            value: "11",
            digested: 3,
          },
          suffix: "i",
          separators: [
            { index: 1, content: "-" },
            { index: 5, content: "-" },
            { index: 9, content: "-" },
          ],
        },
      });
    });

    test("reject if all parts are empty", () => {
      expectReject(lexer, ",");
      expectReject(lexer, "e");
      expectReject(lexer, "-");
      expectReject(lexer, "-,e");
    });

    test("reject if only exponent exists", () => {
      expectReject(lexer, "e1");
      expectReject(lexer, ",e1");
      expectReject(lexer, "-,e1");
      expectReject(lexer, ",-e1");
      expectReject(lexer, ",e-1");
      expectReject(lexer, ",e1-");
      expectReject(lexer, "-,-e-1-");
    });
  });
});
