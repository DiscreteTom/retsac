import { Lexer } from "../../../src";

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
        Lexer.comment("#", "\n"),
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
});
