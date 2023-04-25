import { Lexer } from "../../src";
import { exact, fromTo, stringLiteral, word, wordType } from "../../src/lexer";

test("lexer utils fromTo", () => {
  const lexer = new Lexer.Builder()
    .define({
      a: fromTo("a", "b", { acceptEof: false }),
      c: fromTo("c", "d", { acceptEof: true }),
      e: fromTo(/^e/, /f/, { acceptEof: false }),
    })
    .build();
  expect(lexer.reset().lex("ab")?.content).toBe("ab");
  expect(lexer.reset().lex("a   b")?.content).toBe("a   b");
  expect(lexer.reset().lex("a ")?.content).toBe(undefined);
  expect(lexer.reset().lex("cd")?.content).toBe("cd");
  expect(lexer.reset().lex("c ")?.content).toBe("c ");
  expect(lexer.reset().lex("ef")?.content).toBe("ef");
  expect(lexer.reset().lex("e  f")?.content).toBe("e  f");
});

test("lexer utils exact", () => {
  const lexer = new Lexer.Builder()
    .define({
      a: exact("123"),
    })
    .build();
  expect(lexer.reset().lex("1")?.content).toBe(undefined);
  expect(lexer.reset().lex("123")?.content).toBe("123");
  expect(lexer.reset().lex("1234")?.content).toBe("123");
});

test("lexer utils word", () => {
  const lexer = new Lexer.Builder()
    .define({
      a: word("123"),
    })
    .build();
  expect(lexer.reset().lex("1")?.content).toBe(undefined);
  expect(lexer.reset().lex("123")?.content).toBe("123");
  expect(lexer.reset().lex("1234")?.content).toBe(undefined);
  expect(lexer.reset().lex("123 ")?.content).toBe("123");
});

test("lexer utils wordType", () => {
  const lexer = new Lexer.Builder().define(wordType("123")).build();

  expect(lexer.reset().lex("123")?.type).toBe("123");
});

test("lexer utils stringLiteral", () => {
  const lexer = new Lexer.Builder()
    .define({
      str1: stringLiteral(`'`).or(stringLiteral(`"`)),
      str2: stringLiteral("`", { multiline: true }),
      str3: stringLiteral("a", { close: "b" }),
      str4: stringLiteral("&"),
    })
    .build();

  expect(lexer.reset().lex(`""`)?.content).toBe(`""`);
  expect(lexer.reset().lex(`"123"`)?.content).toBe(`"123"`);
  expect(lexer.reset().lex(`"123\\""`)?.content).toBe(`"123\\""`);
  expect(lexer.reset().lex(`"123\n\\""`)).toBe(null);
  expect(lexer.reset().lex(`''`)?.content).toBe(`''`);
  expect(lexer.reset().lex(`'123'`)?.content).toBe(`'123'`);
  expect(lexer.reset().lex(`'123\\''`)?.content).toBe(`'123\\''`);
  expect(lexer.reset().lex("`123\n123`")?.content).toBe("`123\n123`");
  expect(lexer.reset().lex("ab")?.content).toBe("ab");
  expect(lexer.reset().lex("a123b")?.content).toBe("a123b");
  expect(lexer.reset().lex("a123\\bb")?.content).toBe("a123\\bb");
  expect(lexer.reset().lex("&&")?.content).toBe("&&");
  expect(lexer.reset().lex("&123&")?.content).toBe("&123&");
  expect(lexer.reset().lex("&123\\&&")?.content).toBe("&123\\&&");

  // EOF
  expect(lexer.reset().lex(`"`)).toBe(null);
  expect(lexer.reset().lex(`"123`)).toBe(null);
  expect(lexer.reset().lex(`"123\\"`)).toBe(null);
  expect(lexer.reset().lex(`'`)).toBe(null);
  expect(lexer.reset().lex(`'123`)).toBe(null);
  expect(lexer.reset().lex(`'123\\'`)).toBe(null);
  expect(lexer.reset().lex("`123\n123")).toBe(null);
  expect(lexer.reset().lex("a")).toBe(null);
  expect(lexer.reset().lex("a123")).toBe(null);
  expect(lexer.reset().lex("a123\\b")).toBe(null);
  expect(lexer.reset().lex("&")).toBe(null);
  expect(lexer.reset().lex("&123")).toBe(null);
  expect(lexer.reset().lex("&123\\&")).toBe(null);
});

test("lexer utils whitespaces", () => {
  const lexer = new Lexer.Builder().define({ ws: Lexer.whitespaces }).build();

  expect(lexer.reset().lex(`123`)).toBe(null);
  expect(lexer.reset().lex(` `)?.content).toBe(` `);
  expect(lexer.reset().lex(`  `)?.content).toBe(`  `);
  expect(lexer.reset().lex(`\t`)?.content).toBe(`\t`);
  expect(lexer.reset().lex(`\t\t`)?.content).toBe(`\t\t`);
  expect(lexer.reset().lex(`\n`)?.content).toBe(`\n`);
  expect(lexer.reset().lex(`\n\n`)?.content).toBe(`\n\n`);
  expect(lexer.reset().lex(` \t\n`)?.content).toBe(` \t\n`);
});
