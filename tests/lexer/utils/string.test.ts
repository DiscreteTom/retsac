import { Lexer } from "../../../src";

describe("stringLiteral", () => {
  function expectAccept(
    lexer: Lexer.Lexer<
      {
        kind: "string";
        data: {
          value: string;
          unclosed: boolean;
          escapes: Lexer.EscapeInfo[];
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

  function expectReject(
    lexer: Lexer.Lexer<
      {
        kind: "string";
        data: {
          value: string;
          unclosed: boolean;
          escapes: Lexer.EscapeInfo[];
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

  describe("enable multiline", () => {
    const lexer = new Lexer.Builder()
      .define({ string: Lexer.stringLiteral(`'`, { multiline: true }) })
      .build();

    test("multiline will be accepted", () => {
      expectAccept(lexer, `'123\n'`);
    });
  });
});
