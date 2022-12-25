import { Lexer } from "../src";
import {
  Action,
  exact,
  from_to,
  stringLiteral,
  word,
  wordType,
} from "../src/lexer";
import { Token } from "../src/lexer/model";

test("lexer utils from_to", () => {
  const lexer = new Lexer.Builder()
    .define({
      a: from_to("a", "b", false),
      c: from_to("c", "d", true),
      e: from_to(/^e/, /f/, false),
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
      str1: stringLiteral({ single: true, double: true }),
      str2: stringLiteral({ back: true, multiline: true }),
      str3: stringLiteral({ from: "a", to: "b" }),
      str4: stringLiteral({ quote: "&" }),
    })
    .build();

  expect(lexer.reset().lex(`"123"`)?.content).toBe(`"123"`);
  expect(lexer.reset().lex(`'123'`)?.content).toBe(`'123'`);
  expect(lexer.reset().lex("`123\n123`")?.content).toBe("`123\n123`");
  expect(lexer.reset().lex("a123b")?.content).toBe("a123b");
  expect(lexer.reset().lex("&123&")?.content).toBe("&123&");
});
