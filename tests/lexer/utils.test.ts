import { Lexer } from "../../src";
import {
  ILexer,
  exact,
  fromTo,
  stringLiteral,
  whitespaces,
  word,
  wordType,
} from "../../src/lexer";

test("lexer utils fromTo", () => {
  const lexer = new Lexer.Builder()
    .ignore(whitespaces)
    .define({
      a: fromTo("a", "b", { acceptEof: false }),
      c: fromTo("c", "d", { acceptEof: true }),
      e: fromTo(/e/, /f/, { acceptEof: false }),
    })
    .build();
  expect(lexer.reset().lex("ab")?.content).toBe("ab");
  expect(lexer.reset().lex("a   b")?.content).toBe("a   b");
  expect(lexer.reset().lex("a ")?.content).toBe(undefined);
  expect(lexer.reset().lex("cd")?.content).toBe("cd");
  expect(lexer.reset().lex("c ")?.content).toBe("c ");
  expect(lexer.reset().lex("ef")?.content).toBe("ef");
  expect(lexer.reset().lex("e  f")?.content).toBe("e  f");
  expect(lexer.reset().lex("e")).toBe(null);

  // additional test for #6
  expect(lexer.reset().lex("  ab")?.content).toBe("ab");
  expect(lexer.reset().lex("  a   b")?.content).toBe("a   b");
  expect(lexer.reset().lex("  a ")?.content).toBe(undefined);
  expect(lexer.reset().lex("  cd")?.content).toBe("cd");
  expect(lexer.reset().lex("  c ")?.content).toBe("c ");
  expect(lexer.reset().lex("  ef")?.content).toBe("ef");
  expect(lexer.reset().lex("  e  f")?.content).toBe("e  f");
  expect(lexer.reset().lex("  e")).toBe(null);
});

test("lexer utils exact", () => {
  const lexer = new Lexer.Builder()
    .ignore(whitespaces)
    .define({
      a: exact("123"),
    })
    .build();
  expect(lexer.reset().lex("1")?.content).toBe(undefined);
  expect(lexer.reset().lex("123")?.content).toBe("123");
  expect(lexer.reset().lex("1234")?.content).toBe("123");

  // additional test for #6
  expect(lexer.reset().lex("  1")?.content).toBe(undefined);
  expect(lexer.reset().lex("  123")?.content).toBe("123");
  expect(lexer.reset().lex("  1234")?.content).toBe("123");
});

test("lexer utils word", () => {
  const lexer = new Lexer.Builder()
    .ignore(whitespaces)
    .define({
      a: word("123"),
    })
    .build();
  expect(lexer.reset().lex("1")?.content).toBe(undefined);
  expect(lexer.reset().lex("123")?.content).toBe("123");
  expect(lexer.reset().lex("1234")?.content).toBe(undefined);
  expect(lexer.reset().lex("123 ")?.content).toBe("123");

  // additional test for #6
  expect(lexer.reset().lex("  1")?.content).toBe(undefined);
  expect(lexer.reset().lex("  123")?.content).toBe("123");
  expect(lexer.reset().lex("  1234")?.content).toBe(undefined);
  expect(lexer.reset().lex("  123 ")?.content).toBe("123");
});

test("lexer utils wordType", () => {
  const lexer = new Lexer.Builder()
    .ignore(whitespaces)
    .define(wordType("123"))
    .build();

  expect(lexer.reset().lex("123")?.type).toBe("123");
});

test("lexer utils stringLiteral", () => {
  const lexer = new Lexer.Builder()
    .ignore(whitespaces)
    .define({
      string: stringLiteral(`'`)
        .or(stringLiteral(`"`, { escape: false }))
        .or(stringLiteral("`", { multiline: true }))
        .or(stringLiteral("a", { close: "b" }))
        .or(stringLiteral("c", { unclosedError: "my error" }))
        .or(stringLiteral("d", { acceptUnclosed: false }))
        .or(stringLiteral("e", { multiline: true, escape: false }))
        .or(
          stringLiteral("f", {
            multiline: true,
            escape: false,
            acceptUnclosed: false,
          })
        )
        .or(
          stringLiteral("g", {
            escape: false,
            acceptUnclosed: false,
          })
        ),
    })
    .build();

  // simple string
  expect(lexer.reset().lex(`'123'`)?.content).toBe(`'123'`);
  // accept escaped by default
  expect(lexer.reset().lex(`'123\\''`)?.content).toBe(`'123\\''`);
  // reject multiline but accept unclosed by default
  let token1 = lexer.reset().lex(`'123\n123'`);
  expect(token1?.content).toBe(`'123\n`);
  expect(token1?.error).toBe("unclosed string literal");
  // accept unclosed by default
  let token2 = lexer.reset().lex(`'123`);
  expect(token2?.content).toBe(`'123`);
  expect(token2?.error).toBe("unclosed string literal");
  // disable escaped
  expect(lexer.reset().lex(`"123"`)?.content).toBe(`"123"`);
  expect(lexer.reset().lex(`"123\\""`)?.content).toBe(`"123\\"`);
  expect(lexer.reset().lex(`"123\n"`)?.error).toBe(`unclosed string literal`);
  expect(lexer.reset().lex(`"123`)?.error).toBe(`unclosed string literal`);
  // enable multiline
  expect(lexer.reset().lex("`123`")?.content).toBe("`123`");
  expect(lexer.reset().lex("`123\n123`")?.content).toBe("`123\n123`");
  // customize border
  expect(lexer.reset().lex("a123b")?.content).toBe("a123b");
  // accept unclosed, customize error
  expect(lexer.reset().lex("c123")?.error).toBe("my error");
  // reject unclosed
  expect(lexer.reset().lex("d123")).toBe(null);
  expect(lexer.reset().lex("d123\nd")).toBe(null);
  // not escape, but multiline
  expect(lexer.reset().lex("e123\ne")?.content).toBe("e123\ne");
  expect(lexer.reset().lex("e123\n\\ee")?.content).toBe("e123\n\\e");
  expect(lexer.reset().lex("e123\n123")?.content).toBe("e123\n123");
  // not escape, multiline, reject unclosed
  expect(lexer.reset().lex("f123\n123")).toBe(null);
  // not escape, reject unclosed, not multiline
  expect(lexer.reset().lex("g123")).toBe(null);
  expect(lexer.reset().lex("g123\ng")).toBe(null);
  expect(lexer.reset().lex("g123g")).not.toBe(null);

  // additional test for #6
  expect(lexer.reset().lex(`  '123'`)?.content).toBe(`'123'`);
  expect(lexer.reset().lex(`  '123\\''`)?.content).toBe(`'123\\''`);
  token1 = lexer.reset().lex(`  '123\n123'`);
  expect(token1?.content).toBe(`'123\n`);
  expect(token1?.error).toBe("unclosed string literal");
  token2 = lexer.reset().lex(`  '123`);
  expect(token2?.content).toBe(`'123`);
  expect(token2?.error).toBe("unclosed string literal");
  expect(lexer.reset().lex(`  "123"`)?.content).toBe(`"123"`);
  expect(lexer.reset().lex(`  "123\\""`)?.content).toBe(`"123\\"`);
  expect(lexer.reset().lex(`  "123\n"`)?.error).toBe(`unclosed string literal`);
  expect(lexer.reset().lex(`  "123`)?.error).toBe(`unclosed string literal`);
  expect(lexer.reset().lex("  `123`")?.content).toBe("`123`");
  expect(lexer.reset().lex("  `123\n123`")?.content).toBe("`123\n123`");
  expect(lexer.reset().lex("  a123b")?.content).toBe("a123b");
  expect(lexer.reset().lex("  c123")?.error).toBe("my error");
  expect(lexer.reset().lex("  d123")).toBe(null);
  expect(lexer.reset().lex("  d123\nd")).toBe(null);
  expect(lexer.reset().lex("  e123\ne")?.content).toBe("e123\ne");
  expect(lexer.reset().lex("  e123\n\\ee")?.content).toBe("e123\n\\e");
  expect(lexer.reset().lex("  e123\n123")?.content).toBe("e123\n123");
  expect(lexer.reset().lex("  f123\n123")).toBe(null);
  expect(lexer.reset().lex("  g123")).toBe(null);
  expect(lexer.reset().lex("  g123\ng")).toBe(null);
  expect(lexer.reset().lex("  g123g")).not.toBe(null);
});

test("lexer utils whitespaces", () => {
  const lexer = new Lexer.Builder()
    .ignore(word("ignore"))
    .define({ ws: Lexer.whitespaces })
    .build();

  expect(lexer.reset().lex(`123`)).toBe(null);
  expect(lexer.reset().lex(` `)?.content).toBe(` `);
  expect(lexer.reset().lex(`  `)?.content).toBe(`  `);
  expect(lexer.reset().lex(`\t`)?.content).toBe(`\t`);
  expect(lexer.reset().lex(`\t\t`)?.content).toBe(`\t\t`);
  expect(lexer.reset().lex(`\n`)?.content).toBe(`\n`);
  expect(lexer.reset().lex(`\n\n`)?.content).toBe(`\n\n`);
  expect(lexer.reset().lex(` \t\n`)?.content).toBe(` \t\n`);

  // additional test for #6
  expect(lexer.reset().lex(`ignore123`)).toBe(null);
  expect(lexer.reset().lex(`ignore `)?.content).toBe(` `);
  expect(lexer.reset().lex(`ignore  `)?.content).toBe(`  `);
  expect(lexer.reset().lex(`ignore\t`)?.content).toBe(`\t`);
  expect(lexer.reset().lex(`ignore\t\t`)?.content).toBe(`\t\t`);
  expect(lexer.reset().lex(`ignore\n`)?.content).toBe(`\n`);
  expect(lexer.reset().lex(`ignore\n\n`)?.content).toBe(`\n\n`);
  expect(lexer.reset().lex(`ignore \t\n`)?.content).toBe(` \t\n`);
});

test("lexer utils comment", () => {
  const lexer = new Lexer.Builder()
    .ignore(whitespaces)
    .define({
      comment: Lexer.comment("//")
        .or(Lexer.comment("/*", "*/"))
        .or(Lexer.comment("#", "\n", { acceptEof: false })),
    })
    .build();

  expect(lexer.reset().lex(`123`)).toBe(null);
  expect(lexer.reset().lex(`// 123`)?.content).toBe(`// 123`);
  expect(lexer.reset().lex(`// 123\n`)?.content).toBe(`// 123\n`);
  expect(lexer.reset().lex(`// 123\n123`)?.content).toBe(`// 123\n`);
  expect(lexer.reset().lex(`/* 123 */`)?.content).toBe(`/* 123 */`);
  expect(lexer.reset().lex(`/* 123\n123 */`)?.content).toBe(`/* 123\n123 */`);
  expect(lexer.reset().lex(`/* 123\n123 */123`)?.content).toBe(
    `/* 123\n123 */`
  );
  expect(lexer.reset().lex(`# 123\n123`)?.content).toBe(`# 123\n`);
  expect(lexer.reset().lex(`# 123`)).toBe(null);

  // additional test for #6
  expect(lexer.reset().lex(`  123`)).toBe(null);
  expect(lexer.reset().lex(`  // 123`)?.content).toBe(`// 123`);
  expect(lexer.reset().lex(`  // 123\n`)?.content).toBe(`// 123\n`);
  expect(lexer.reset().lex(`  // 123\n123`)?.content).toBe(`// 123\n`);
  expect(lexer.reset().lex(`  /* 123 */`)?.content).toBe(`/* 123 */`);
  expect(lexer.reset().lex(`  /* 123\n123 */`)?.content).toBe(`/* 123\n123 */`);
  expect(lexer.reset().lex(`  /* 123\n123 */123`)?.content).toBe(
    `/* 123\n123 */`
  );
  expect(lexer.reset().lex(`  # 123\n123`)?.content).toBe(`# 123\n`);
  expect(lexer.reset().lex(`  # 123`)).toBe(null);
});

test("lexer utils numericLiteral", () => {
  const lexer = new Lexer.Builder()
    .ignore(whitespaces)
    .define({ number: Lexer.numericLiteral() })
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
    `1_000_000.000_001`
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
    `1_000_000.000_001`
  );
  expect(lexer.reset().lex(`  1e6_000`)?.content).toBe(`1e6_000`);

  // invalid
  expect(lexer.reset().lex(`0o79`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`0xyz`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`1.2.`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`1..2`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`1e1e1`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`1e`)?.error).toBe("invalid numeric literal");
  // additional test for #6
  expect(lexer.reset().lex(`  0o79`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`  0xyz`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`  1.2.`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`  1..2`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`  1e1e1`)?.error).toBe("invalid numeric literal");
  expect(lexer.reset().lex(`  1e`)?.error).toBe("invalid numeric literal");

  // boundary
  expect(lexer.reset().lex(`123abc`)).toBe(null); // no boundary
  expect(lexer.reset().lex(`123 abc`)).not.toBe(null); // boundary
  // additional test for #6
  expect(lexer.reset().lex(`  123abc`)).toBe(null); // no boundary
  expect(lexer.reset().lex(`  123 abc`)).not.toBe(null); // boundary

  // disable/custom numericSeparator
  const lexer2 = new Lexer.Builder()
    .define({
      number: Lexer.numericLiteral({ numericSeparator: false }).or(
        Lexer.numericLiteral({ numericSeparator: "-" })
      ),
    })
    .build();
  expect(lexer2.reset().lex(`1_000_000`)).toBe(null);
  expect(lexer2.reset().lex(`1-000-000`)?.content).toBe(`1-000-000`);
  // additional test for #6
  expect(lexer2.reset().lex(`  1_000_000`)).toBe(null);
  expect(lexer2.reset().lex(`  1-000-000`)?.content).toBe(`1-000-000`);

  // disable boundary check
  const lexer3 = new Lexer.Builder()
    .define({ number: Lexer.numericLiteral({ boundary: false }) })
    .build();
  expect(lexer3.reset().lex(`123abc`)?.content).toBe(`123`); // ignore boundary
  // additional test for #6
  expect(lexer3.reset().lex(`  123abc`)?.content).toBe(`123`); // ignore boundary

  // reject invalid
  const lexer4 = new Lexer.Builder()
    .define({ number: Lexer.numericLiteral({ acceptInvalid: false }) })
    .build();
  expect(lexer4.reset().lex(`0o79`)).toBe(null);
  // additional test for #6
  expect(lexer4.reset().lex(`  0o79`)).toBe(null);

  // custom invalid error
  const lexer5 = new Lexer.Builder()
    .define({ number: Lexer.numericLiteral({ invalidError: "my error" }) })
    .build();
  expect(lexer5.reset().lex(`0o79`)?.error).toBe("my error");
  // additional test for #6
  expect(lexer5.reset().lex(` 0o79`)?.error).toBe("my error");
});
