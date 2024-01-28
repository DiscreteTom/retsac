import { Lexer } from "../../../src";

test("lexer utils exact", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({
      a: Lexer.exact("123"),
    })
    .build();
  expect(lexer.reload("1").lex().token?.content).toBe(undefined);
  expect(lexer.reload("123").lex().token?.content).toBe("123");
  expect(lexer.reload("1234").lex().token?.content).toBe("123");

  // additional test for #6
  expect(lexer.reload("  1").lex().token?.content).toBe(undefined);
  expect(lexer.reload("  123").lex().token?.content).toBe("123");
  expect(lexer.reload("  1234").lex().token?.content).toBe("123");
});

test("lexer utils exactArray", () => {
  const actions = Lexer.exactArray("123", "456");
  expect(actions.length).toBe(2);

  const lexer = new Lexer.Builder().anonymous(...actions).build();
  expect(lexer.reload("123").lex().token?.content).toBe("123");
  expect(lexer.reload("123456").lex().token?.content).toBe("123");
  expect(lexer.reload("456").lex().token?.content).toBe("456");
  expect(lexer.reload("456123").lex().token?.content).toBe("456");
});

test("lexer utils exactKind", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define(Lexer.exactKind("123"))
    .build();

  expect(lexer.reload("123").lex().token?.kind).toBe("123");
  expect(lexer.reload("123456").lex().token?.kind).toBe("123");
});

test("lexer utils word", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({
      a: Lexer.word("123"),
    })
    .build();
  expect(lexer.reload("1").lex().token?.content).toBe(undefined);
  expect(lexer.reload("123").lex().token?.content).toBe("123");
  expect(lexer.reload("1234").lex().token?.content).toBe(undefined);
  expect(lexer.reload("123 ").lex().token?.content).toBe("123");

  // additional test for #6
  expect(lexer.reload("  1").lex().token?.content).toBe(undefined);
  expect(lexer.reload("  123").lex().token?.content).toBe("123");
  expect(lexer.reload("  1234").lex().token?.content).toBe(undefined);
  expect(lexer.reload("  123 ").lex().token?.content).toBe("123");
});

test("lexer utils wordArray", () => {
  const actions = Lexer.wordArray("123", "456");
  expect(actions.length).toBe(2);

  const lexer = new Lexer.Builder().anonymous(...actions).build();
  expect(lexer.reload("123").lex().token?.content).toBe("123");
  expect(lexer.reload("123 123").lex().token?.content).toBe("123");
  expect(lexer.reload("123123").lex().token?.content).toBe(undefined);
  expect(lexer.reload("456").lex().token?.content).toBe("456");
  expect(lexer.reload("456 456").lex().token?.content).toBe("456");
  expect(lexer.reload("456456").lex().token?.content).toBe(undefined);
});

test("lexer utils wordKind", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define(Lexer.wordKind("123"))
    .build();

  expect(lexer.reload("123").lex().token?.kind).toBe("123");
  expect(lexer.reload("123123").lex().token?.kind).toBe(undefined);
});

test("lexer utils Lexer.whitespaces()", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.word("ignore"))
    .define({ ws: Lexer.whitespaces() })
    .build();

  expect(lexer.reload(`123`).lex().token).toBe(undefined);
  expect(lexer.reload(` `).lex().token?.content).toBe(` `);
  expect(lexer.reload(`  `).lex().token?.content).toBe(`  `);
  expect(lexer.reload(`\t`).lex().token?.content).toBe(`\t`);
  expect(lexer.reload(`\t\t`).lex().token?.content).toBe(`\t\t`);
  expect(lexer.reload(`\n`).lex().token?.content).toBe(`\n`);
  expect(lexer.reload(`\n\n`).lex().token?.content).toBe(`\n\n`);
  expect(lexer.reload(` \t\n`).lex().token?.content).toBe(` \t\n`);

  // additional test for #6
  expect(lexer.reload(`ignore123`).lex().token).toBe(undefined);
  expect(lexer.reload(`ignore `).lex().token?.content).toBe(` `);
  expect(lexer.reload(`ignore  `).lex().token?.content).toBe(`  `);
  expect(lexer.reload(`ignore\t`).lex().token?.content).toBe(`\t`);
  expect(lexer.reload(`ignore\t\t`).lex().token?.content).toBe(`\t\t`);
  expect(lexer.reload(`ignore\n`).lex().token?.content).toBe(`\n`);
  expect(lexer.reload(`ignore\n\n`).lex().token?.content).toBe(`\n\n`);
  expect(lexer.reload(`ignore \t\n`).lex().token?.content).toBe(` \t\n`);
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

  expect(lexer.reload(`123`).lex().token).toBe(undefined);
  expect(lexer.reload(`// 123`).lex().token?.content).toBe(`// 123`);
  expect(lexer.reload(`// 123\n`).lex().token?.content).toBe(`// 123\n`);
  expect(lexer.reload(`// 123\n123`).lex().token?.content).toBe(`// 123\n`);
  expect(lexer.reload(`/* 123 */`).lex().token?.content).toBe(`/* 123 */`);
  expect(lexer.reload(`/* 123\n123 */`).lex().token?.content).toBe(
    `/* 123\n123 */`,
  );
  expect(lexer.reload(`/* 123\n123 */123`).lex().token?.content).toBe(
    `/* 123\n123 */`,
  );
  expect(lexer.reload(`# 123\n123`).lex().token?.content).toBe(`# 123\n`);

  // additional test for #6
  expect(lexer.reload(`  123`).lex().token).toBe(undefined);
  expect(lexer.reload(`  // 123`).lex().token?.content).toBe(`// 123`);
  expect(lexer.reload(`  // 123\n`).lex().token?.content).toBe(`// 123\n`);
  expect(lexer.reload(`  // 123\n123`).lex().token?.content).toBe(`// 123\n`);
  expect(lexer.reload(`  /* 123 */`).lex().token?.content).toBe(`/* 123 */`);
  expect(lexer.reload(`  /* 123\n123 */`).lex().token?.content).toBe(
    `/* 123\n123 */`,
  );
  expect(lexer.reload(`  /* 123\n123 */123`).lex().token?.content).toBe(
    `/* 123\n123 */`,
  );
  expect(lexer.reload(`  # 123\n123`).lex().token?.content).toBe(`# 123\n`);
});
