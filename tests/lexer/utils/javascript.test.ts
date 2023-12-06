import { Lexer } from "../../../src";

test("lexer utils javascript.numericLiteral", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({ number: Lexer.javascript.numericLiteral() })
    .build();

  // valid
  expect(lexer.reset().lex(`42`)?.content).toBe(`42`);
  expect(lexer.reset().lex(`3.1415`)?.content).toBe(`3.1415`);
  expect(lexer.reset().lex(`1.5e10`)?.content).toBe(`1.5e10`);
  expect(lexer.reset().lex(`0.123e-4`)?.content).toBe(`0.123e-4`);
  expect(lexer.reset().lex(`0x2a`)?.content).toBe(`0x2a`);
  expect(lexer.reset().lex(`0xFF`)?.content).toBe(`0xFF`);
  expect(lexer.reset().lex(`0o755`)?.content).toBe(`0o755`);
  expect(lexer.reset().lex(`1_000_000`)?.content).toBe(`1_000_000`);
  expect(lexer.reset().lex(`1_000_000.000_001`)?.content).toBe(
    `1_000_000.000_001`,
  );
  expect(lexer.reset().lex(`1e6_000`)?.content).toBe(`1e6_000`);
  // additional test for #6
  expect(lexer.reset().lex(`  42`)?.content).toBe(`42`);
  expect(lexer.reset().lex(`  3.1415`)?.content).toBe(`3.1415`);
  expect(lexer.reset().lex(`  1.5e10`)?.content).toBe(`1.5e10`);
  expect(lexer.reset().lex(`  0.123e-4`)?.content).toBe(`0.123e-4`);
  expect(lexer.reset().lex(`  0x2a`)?.content).toBe(`0x2a`);
  expect(lexer.reset().lex(`  0xFF`)?.content).toBe(`0xFF`);
  expect(lexer.reset().lex(`  0o755`)?.content).toBe(`0o755`);
  expect(lexer.reset().lex(`  1_000_000`)?.content).toBe(`1_000_000`);
  expect(lexer.reset().lex(`  1_000_000.000_001`)?.content).toBe(
    `1_000_000.000_001`,
  );
  expect(lexer.reset().lex(`  1e6_000`)?.content).toBe(`1e6_000`);

  // invalid
  expect(lexer.reset().lex(`0o79`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`0xyz`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`1.2.`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`1..2`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`1e1e1`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`1e`)?.data!.invalid).toBe(true);
  // additional test for #6
  expect(lexer.reset().lex(`  0o79`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`  0xyz`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`  1.2.`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`  1..2`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`  1e1e1`)?.data!.invalid).toBe(true);
  expect(lexer.reset().lex(`  1e`)?.data!.invalid).toBe(true);

  // boundary
  expect(lexer.reset().lex(`123abc`)).toBe(null); // no boundary
  expect(lexer.reset().lex(`123 abc`)).not.toBe(null); // boundary
  // additional test for #6
  expect(lexer.reset().lex(`  123abc`)).toBe(null); // no boundary
  expect(lexer.reset().lex(`  123 abc`)).not.toBe(null); // boundary

  // disable/custom numericSeparator
  const lexer2 = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({
      number: [
        Lexer.javascript.numericLiteral({ numericSeparator: "-" }),
        Lexer.javascript.numericLiteral({ numericSeparator: false }),
      ],
    })
    .build();
  expect(lexer2.reset().lex(`1_000_000`)).toBe(null);
  expect(lexer2.reset().lex(`1-000-000`)?.content).toBe(`1-000-000`);
  // additional test for #6
  expect(lexer2.reset().lex(`  1_000_000`)).toBe(null);
  expect(lexer2.reset().lex(`  1-000-000`)?.content).toBe(`1-000-000`);

  // disable boundary check
  const lexer3 = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({ number: Lexer.javascript.numericLiteral({ boundary: false }) })
    .build();
  expect(lexer3.reset().lex(`123abc`)?.content).toBe(`123`); // ignore boundary
  // additional test for #6
  expect(lexer3.reset().lex(`  123abc`)?.content).toBe(`123`); // ignore boundary

  // reject invalid
  const lexer4 = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({
      number: Lexer.javascript.numericLiteral({ acceptInvalid: false }),
    })
    .build();
  expect(lexer4.reset().lex(`0o79`)).toBe(null);
  // additional test for #6
  expect(lexer4.reset().lex(`  0o79`)).toBe(null);

  const lexer6 = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({
      number: Lexer.javascript.numericLiteral({
        numericSeparator: false,
        boundary: false,
      }),
    })
    .build();
  expect(lexer6.reset().lex("123a")?.content).toBe("123");
});

test("lexer utils javascript.regexLiteral", () => {
  const lexer1 = new Lexer.Builder()
    .define({ regex: Lexer.javascript.regexLiteral() })
    .build();

  // simple
  expect(lexer1.reset().lex("/a/")?.content).toBe("/a/");
  // complex
  expect(
    lexer1.reset().lex("/\\/(?:[^\\/\\\\]|\\\\.)+\\/(?:[gimuy]*)(?=\\W|$)/")
      ?.content,
  ).toBe("/\\/(?:[^\\/\\\\]|\\\\.)+\\/(?:[gimuy]*)(?=\\W|$)/");
  // with flags
  expect(lexer1.reset().lex("/a/g")?.content).toBe("/a/g");
  // reject invalid
  expect(lexer1.reset().lex("/++/")).toBe(null);
  expect(lexer1.reset().lex("/++/")).toBe(null);
  // ensure boundary
  expect(lexer1.reset().lex("/a/abc")).toBe(null);

  // accept invalid
  const lexer3 = new Lexer.Builder()
    .define({
      regex: Lexer.javascript.regexLiteral({ rejectOnInvalid: false }),
    })
    .build();
  expect(lexer3.reset().lex("/++/")?.content).toBe("/++/");
  expect(lexer3.reset().lex("/++/")?.data.invalid).toBe(true);
  expect(lexer3.reset().lex("/a/")?.data.invalid).toBe(false);

  // don't ensure boundary
  const lexer4 = new Lexer.Builder()
    .define({ regex: Lexer.javascript.regexLiteral({ boundary: false }) })
    .build();
  expect(lexer4.reset().lex("/a/abc")?.content).toBe("/a/");

  // don't validate
  const lexer5 = new Lexer.Builder()
    .define({ regex: Lexer.javascript.regexLiteral({ validate: false }) })
    .build();
  expect(lexer5.reset().lex("/++/")?.content).toBe("/++/");
  expect(lexer5.reset().lex("/++/")?.data.invalid).toBe(false);
});

test("javascript comment", () => {
  const lexer = new Lexer.Builder()
    .define({
      comment: Lexer.javascript.comment(),
    })
    .build();

  // single line
  expect(lexer.reset().lex("// abc\n")?.content).toBe("// abc\n");
  expect(lexer.reset().lex("// abc\n// def")?.content).toBe("// abc\n");

  // multi line
  expect(lexer.reset().lex("/* abc */")?.content).toBe("/* abc */");
  expect(lexer.reset().lex("/* abc\n*/")?.content).toBe("/* abc\n*/");
  expect(lexer.reset().lex("/* abc\n*/\n")?.content).toBe("/* abc\n*/");

  // unclosed
  expect(lexer.reset().lex("// abc")?.content).toBe("// abc");
  expect(lexer.reset().lex("/* abc")?.content).toBe("/* abc");
});

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

describe("simpleStringLiteral", () => {
  const lexer = new Lexer.Builder()
    .define({ string: Lexer.javascript.simpleStringLiteral() })
    .build();

  function expectAcceptString(
    input: string,
    overrides: Partial<NonNullable<ReturnType<typeof lexer.lex>>> &
      Pick<NonNullable<ReturnType<typeof lexer.lex>>, "data">,
  ) {
    const token = lexer.reset().lex(input)!;
    expect(token).not.toBeNull();
    expect(token.kind).toBe("string");
    expect(token.content).toBe(overrides.content ?? input);
    expect(token.start).toBe(0);
    expect(token.data.value).toBe(overrides.data!.value);
    expect(token.data.errors).toEqual(overrides.data!.errors);
  }

  test("reject non string", () => {
    expect(lexer.reset().lex("123")).toBeNull();
  });

  test("simple single quote", () => {
    expectAcceptString(`'123'`, {
      data: {
        value: "123",
        errors: [],
      },
    });
  });
  test("simple double quote", () => {
    expectAcceptString(`"123"`, {
      data: {
        value: "123",
        errors: [],
      },
    });
  });

  describe("UnterminatedStringLiteral", () => {
    test("at start", () => {
      expectAcceptString(`"`, {
        data: {
          value: "",
          errors: [
            {
              kind: Lexer.javascript.ScannerErrorKind.UnterminatedStringLiteral,
              index: 1,
              length: 0,
            },
          ],
        },
      });
    });

    test("at middle", () => {
      expectAcceptString(`"123`, {
        data: {
          value: "123",
          errors: [
            {
              kind: Lexer.javascript.ScannerErrorKind.UnterminatedStringLiteral,
              index: 4,
              length: 0,
            },
          ],
        },
      });
    });

    test("at new line", () => {
      expectAcceptString(`"123\n"`, {
        content: `"123`,
        data: {
          value: "123",
          errors: [
            {
              kind: Lexer.javascript.ScannerErrorKind.UnterminatedStringLiteral,
              index: 4,
              length: 0,
            },
          ],
        },
      });
    });
  });

  describe("bad escape", () => {
    describe("UnexpectedEndOfText", () => {
      test("at start", () => {
        expectAcceptString(`"\\`, {
          content: '"\\',
          data: {
            value: "",
            errors: [
              {
                kind: Lexer.javascript.ScannerErrorKind.UnexpectedEndOfText,
                index: 2,
                length: 0,
              },
              {
                kind: Lexer.javascript.ScannerErrorKind
                  .UnterminatedStringLiteral,
                index: 2,
                length: 0,
              },
            ],
          },
        });
      });

      test("bad code point", () => {
        expectAcceptString(`"\\u{f`, {
          data: {
            value: "\\u{f",
            errors: [
              {
                kind: Lexer.javascript.ScannerErrorKind.UnexpectedEndOfText,
                index: 5,
                length: 0,
              },
              {
                kind: Lexer.javascript.ScannerErrorKind
                  .UnterminatedStringLiteral,
                index: 5,
                length: 0,
              },
            ],
          },
        });
      });
    });

    describe("OctalEscapeSequencesAreNotAllowed", () => {
      test("", () => {
        expectAcceptString(`"\\7"`, {
          data: {
            value: "\x07",
            errors: [
              {
                kind: Lexer.javascript.ScannerErrorKind
                  .OctalEscapeSequencesAreNotAllowed,
                index: 1,
                length: 2,
              },
            ],
          },
        });
      });
    });

    describe("EscapeSequenceIsNotAllowed", () => {
      test("", () => {
        expectAcceptString(`"\\8"`, {
          data: {
            value: "8",
            errors: [
              {
                kind: Lexer.javascript.ScannerErrorKind
                  .EscapeSequenceIsNotAllowed,
                index: 1,
                length: 2,
              },
            ],
          },
        });
      });
    });

    describe("HexadecimalDigitExpected", () => {
      test("in code point", () => {
        expectAcceptString(`"\\u{z}"`, {
          data: {
            value: "\\u{z}",
            errors: [
              {
                kind: Lexer.javascript.ScannerErrorKind
                  .HexadecimalDigitExpected,
                index: 4,
                length: 0,
              },
            ],
          },
        });
      });

      test("in unicode escape", () => {
        expectAcceptString(`"\\uaz"`, {
          data: {
            value: "\\uaz",
            errors: [
              {
                kind: Lexer.javascript.ScannerErrorKind
                  .HexadecimalDigitExpected,
                index: 4,
                length: 0,
              },
            ],
          },
        });
      });

      test("in hex escape", () => {
        expectAcceptString(`"\\xaz"`, {
          data: {
            value: "\\xaz",
            errors: [
              {
                kind: Lexer.javascript.ScannerErrorKind
                  .HexadecimalDigitExpected,
                index: 4,
                length: 0,
              },
            ],
          },
        });
      });
    });

    describe("AnExtendedUnicodeEscapeValueMustBeBetween_0x0_And_0x10FFFF_Inclusive", () => {
      test("", () => {
        expectAcceptString(`"\\u{ffffff}"`, {
          data: {
            value: "\\u{ffffff}",
            errors: [
              {
                kind: Lexer.javascript.ScannerErrorKind
                  .AnExtendedUnicodeEscapeValueMustBeBetween_0x0_And_0x10FFFF_Inclusive,
                index: 10,
                length: 0,
              },
            ],
          },
        });
      });
    });

    describe("UnterminatedUnicodeEscapeSequence", () => {
      test("", () => {
        expectAcceptString(`"\\u{fff"`, {
          data: {
            value: "\\u{fff",
            errors: [
              {
                kind: Lexer.javascript.ScannerErrorKind
                  .UnterminatedUnicodeEscapeSequence,
                index: 7,
                length: 0,
              },
            ],
          },
        });
      });
    });
  });
});
