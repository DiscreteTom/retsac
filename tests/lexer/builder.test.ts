import { Lexer } from "../../src";

const builder = new Lexer.Builder()
  .useError<string>()
  .ignore(Lexer.whitespaces())
  .define({
    number: /[0-9]+/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .define({
    someErr: Lexer.Action.from(/error/).check(() => "some error"),
  });

const lexer = builder.build();

test("builder ignore", () => {
  expect(lexer.reset().lex(" ")).toBe(null);
  expect(lexer.reset().lex("   ")).toBe(null);
});

test("builder define", () => {
  expect(lexer.reset().lex("1")?.kind).toBe("number");
  expect(lexer.reset().lex("123")?.kind).toBe("number");
});

test("builder anonymous", () => {
  expect(lexer.reset().lex("+")?.kind).toBe("");
  expect(lexer.reset().lex("+")?.content).toBe("+");
});

test("builder getTokenKinds", () => {
  expect(Array.from(builder.getTokenKinds()).sort()).toEqual(
    ["", "number", "someErr"].sort(),
  );
});

test("builder define using array", () => {
  const lexer = new Lexer.Builder()
    .define({
      string: [
        Lexer.stringLiteral(`'`),
        Lexer.stringLiteral(`"`),
        Lexer.stringLiteral("`", { multiline: true }),
      ],
    })
    .build();

  expect(lexer.reset().lex(`'abc'`)?.kind).toBe("string");
  expect(lexer.reset().lex(`"abc"`)?.kind).toBe("string");
  expect(lexer.reset().lex("`abc`")?.kind).toBe("string");
});
