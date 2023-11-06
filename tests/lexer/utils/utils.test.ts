import { Lexer } from "../../../src";

test("lexer utils fromTo", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({
      a: Lexer.fromTo("a", "b", { acceptEof: false }),
      c: Lexer.fromTo("c", "d", { acceptEof: true }),
      e: Lexer.fromTo(/e/, /f/, { acceptEof: false }),
      g: Lexer.fromTo(/g/y, "h", { acceptEof: true, autoSticky: false }),
      i: Lexer.fromTo("i", /j/g, { acceptEof: true, autoGlobal: false }),
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
  expect(lexer.reset().lex("gh")?.content).toBe("gh");
  expect(lexer.reset().lex("ij")?.content).toBe("ij");

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
    .ignore(Lexer.whitespaces())
    .define({
      a: Lexer.exact("123"),
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

test("lexer utils exactArray", () => {
  const actions = Lexer.exactArray("123", "456");
  expect(actions.length).toBe(2);

  const lexer = new Lexer.Builder().anonymous(...actions).build();
  expect(lexer.reset().lex("123")?.content).toBe("123");
  expect(lexer.reset().lex("123456")?.content).toBe("123");
  expect(lexer.reset().lex("456")?.content).toBe("456");
  expect(lexer.reset().lex("456123")?.content).toBe("456");
});

test("lexer utils exactKind", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define(Lexer.exactKind("123"))
    .build();

  expect(lexer.reset().lex("123")?.kind).toBe("123");
  expect(lexer.reset().lex("123456")?.kind).toBe("123");
});

test("lexer utils word", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({
      a: Lexer.word("123"),
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

test("lexer utils wordArray", () => {
  const actions = Lexer.wordArray("123", "456");
  expect(actions.length).toBe(2);

  const lexer = new Lexer.Builder().anonymous(...actions).build();
  expect(lexer.reset().lex("123")?.content).toBe("123");
  expect(lexer.reset().lex("123 123")?.content).toBe("123");
  expect(lexer.reset().lex("123123")?.content).toBe(undefined);
  expect(lexer.reset().lex("456")?.content).toBe("456");
  expect(lexer.reset().lex("456 456")?.content).toBe("456");
  expect(lexer.reset().lex("456456")?.content).toBe(undefined);
});

test("lexer utils wordKind", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define(Lexer.wordKind("123"))
    .build();

  expect(lexer.reset().lex("123")?.kind).toBe("123");
  expect(lexer.reset().lex("123123")?.kind).toBe(undefined);
});

test("lexer utils stringLiteral", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({
      string: [
        Lexer.stringLiteral(`'`),
        Lexer.stringLiteral(`"`, { escape: false }),
        Lexer.stringLiteral("`", { multiline: true }),
        Lexer.stringLiteral("a", { close: "b" }),
        Lexer.stringLiteral("d", { acceptUnclosed: false }),
        Lexer.stringLiteral("e", { multiline: true, escape: false }),
        Lexer.stringLiteral("f", {
          multiline: true,
          escape: false,
          acceptUnclosed: false,
        }),
        Lexer.stringLiteral("g", {
          escape: false,
          acceptUnclosed: false,
        }),
        Lexer.stringLiteral("h", { lineContinuation: false }),
      ],
    })
    .build();

  // simple string
  expect(lexer.reset().lex(`'123'`)?.content).toBe(`'123'`);
  // accept escaped by default
  expect(lexer.reset().lex(`'123\\''`)?.content).toBe(`'123\\''`);
  // reject multiline but accept unclosed by default
  let token1 = lexer.reset().lex(`'123\n123'`);
  expect(token1?.content).toBe(`'123`);
  expect(token1?.data!.unclosed).toBe(true);
  // accept unclosed by default
  let token2 = lexer.reset().lex(`'123`);
  expect(token2?.content).toBe(`'123`);
  expect(token2?.data!.unclosed).toBe(true);
  // disable escaped
  expect(lexer.reset().lex(`"123"`)?.content).toBe(`"123"`);
  expect(lexer.reset().lex(`"123\\""`)?.content).toBe(`"123\\"`);
  expect(lexer.reset().lex(`"123\n"`)?.data!.unclosed).toBe(true);
  expect(lexer.reset().lex(`"123`)?.data!.unclosed).toBe(true);
  // enable multiline
  expect(lexer.reset().lex("`123`")?.content).toBe("`123`");
  expect(lexer.reset().lex("`123\n123`")?.content).toBe("`123\n123`");
  // customize border
  expect(lexer.reset().lex("a123b")?.content).toBe("a123b");
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
  // line continuation
  expect(lexer.reset().lex("'123\\\n456'")?.content).toBe("'123\\\n456'");
  expect(lexer.reset().lex("h123\\\n456")).toBe(null);
  // #32, unclosed single line string with `\n` as the tail shouldn't contains `\n`
  expect(lexer.reset().lex("'123\n")?.content).toBe("'123");
  // #32, unclosed multiline string with `\n` as the tail should contains `\n`
  expect(lexer.reset().lex("`123\n")?.content).toBe("`123\n");

  // additional test for #6
  expect(lexer.reset().lex(`  '123'`)?.content).toBe(`'123'`);
  expect(lexer.reset().lex(`  '123\\''`)?.content).toBe(`'123\\''`);
  token1 = lexer.reset().lex(`  '123\n123'`);
  expect(token1?.content).toBe(`'123`);
  expect(token1?.data!.unclosed).toBe(true);
  token2 = lexer.reset().lex(`  '123`);
  expect(token2?.content).toBe(`'123`);
  expect(token2?.data!.unclosed).toBe(true);
  expect(lexer.reset().lex(`  "123"`)?.content).toBe(`"123"`);
  expect(lexer.reset().lex(`  "123\\""`)?.content).toBe(`"123\\"`);
  expect(lexer.reset().lex(`  "123\n"`)?.data!.unclosed).toBe(true);
  expect(lexer.reset().lex(`  "123`)?.data!.unclosed).toBe(true);
  expect(lexer.reset().lex("  `123`")?.content).toBe("`123`");
  expect(lexer.reset().lex("  `123\n123`")?.content).toBe("`123\n123`");
  expect(lexer.reset().lex("  a123b")?.content).toBe("a123b");
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

test("lexer utils Lexer.whitespaces()", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.word("ignore"))
    .define({ ws: Lexer.whitespaces() })
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
    .ignore(Lexer.whitespaces())
    .define({
      comment: [
        Lexer.comment("//"),
        Lexer.comment("/*", "*/"),
        Lexer.comment("#", "\n", { acceptEof: false }),
      ],
    })
    .build();

  expect(lexer.reset().lex(`123`)).toBe(null);
  expect(lexer.reset().lex(`// 123`)?.content).toBe(`// 123`);
  expect(lexer.reset().lex(`// 123\n`)?.content).toBe(`// 123\n`);
  expect(lexer.reset().lex(`// 123\n123`)?.content).toBe(`// 123\n`);
  expect(lexer.reset().lex(`/* 123 */`)?.content).toBe(`/* 123 */`);
  expect(lexer.reset().lex(`/* 123\n123 */`)?.content).toBe(`/* 123\n123 */`);
  expect(lexer.reset().lex(`/* 123\n123 */123`)?.content).toBe(
    `/* 123\n123 */`,
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
    `/* 123\n123 */`,
  );
  expect(lexer.reset().lex(`  # 123\n123`)?.content).toBe(`# 123\n`);
  expect(lexer.reset().lex(`  # 123`)).toBe(null);
});
