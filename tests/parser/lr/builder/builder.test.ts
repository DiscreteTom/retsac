import { Lexer, LR } from "../../../../src";
import { ASTNode } from "../../../../src/parser";
import { ParserBuilder } from "../../../../src/parser/LR";
import { DefinitionContextBuilder } from "../../../../src/parser/LR/builder/ctx-builder";

const lexer = new Lexer.Builder()
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

test("ParserBuilder basics", () => {
  const mathParser = new LR.ParserBuilder()
    .define({ exp: `exp '-' exp` })
    .define({ exp: `exp '+' exp` });

  const parser = new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `number` }, new DefinitionContextBuilder({}))
    .use(mathParser)
    .checkSymbols(new Set(["number"]))
    .build();

  const res = parser.parseAll(
    lexer.lexAll("1+1-1").map((t) => ASTNode.from(t))
  );
  expect(res.accept).toBe(true);
  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(res.buffer[0].toTreeString()).toBe(
      `exp: \n  exp: \n    exp: \n      number: 1\n    <anonymous>: +\n    exp: \n      number: 1\n  <anonymous>: -\n  exp: \n    number: 1\n`
    );
  }
});

test("ParserBuilder simple calculator", () => {
  const mathParser = new LR.ParserBuilder<number>()
    .define(
      { exp: `exp '-' exp` },
      LR.reducer<number>((values) => values[0]! - values[2]!).resolveRS(
        { exp: `exp '+' exp` },
        { next: `'+'` }
      )
    )
    .define(
      { exp: `exp '+' exp` },
      LR.reducer<number>((values) => values[0]! + values[2]!).resolveRS(
        { exp: `exp '-' exp` },
        { next: `'-'` }
      )
    );

  const parser = new LR.ParserBuilder<number>()
    .entry("exp")
    .define(
      { exp: `number` },
      LR.callback((ctx) => (ctx.data = Number(ctx.matched[0].text)))
    )
    .use(mathParser)
    .checkSymbols(new Set(["number"]))
    .build();

  const res = parser.parseAll(
    lexer.lexAll("1+1-1").map((t) => ASTNode.from(t))
  );
  expect(res.accept).toBe(true);
  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(res.buffer[0].data).toBe(1 + 1 - 1);
  }
});

test("ParserBuilder simple errors", () => {
  expect(() => new ParserBuilder().build()).toThrow(
    `Please set entry NTs for LR Parser.`
  );

  expect(() =>
    new ParserBuilder().define({ exp: `number` }).checkSymbols(new Set())
  ).toThrow(`Undefined grammar symbol: number`);

  expect(() =>
    new ParserBuilder()
      .define({ exp: `number` })
      .checkSymbols(new Set(["exp", "number"]))
  ).toThrow(`Duplicated definition for grammar symbol: exp`);

  expect(() =>
    new ParserBuilder().entry("exp").checkSymbols(new Set())
  ).toThrow(`Undefined entry NT: "exp"`);
});

test("ParserBuilder check conflicts", () => {
  // RS conflict
  expect(() =>
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `exp '-' exp` })
      .checkConflicts(lexer)
  ).toThrow(`Unresolved R-S conflict`);
  console.log = jest.fn();
  new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `exp '-' exp` })
    .checkConflicts(lexer, true);
  expect(console.log).toHaveBeenCalledWith(
    "Unresolved R-S conflict (length: 1, next: `'-'`): { exp: `exp '-' exp` } | { exp: `exp '-' exp` }"
  );

  // RR conflict at end of input
  expect(() =>
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `number` })
      .define({ exp: `xxx` })
      .define({ xxx: `number` })
      .checkConflicts(lexer)
  ).toThrow(`Unresolved R-R conflict`);
  console.log = jest.fn();
  new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `number` })
    .define({ exp: `xxx` })
    .define({ xxx: `number` }, LR.resolveRR({ exp: `number` }, { next: `end` }))
    .checkConflicts(lexer, true);
  expect(console.log).toHaveBeenCalledWith(
    "Unresolved R-R conflict (end of input): { exp: `number` } | { xxx: `number` }"
  );

  // RR conflict with next
  expect(() =>
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `number` })
      .define(
        { exp: `xxx` },
        LR.resolveRS({ xxx: `xxx number` }, { next: `number` })
      )
      .define({ xxx: `number` })
      .define({ xxx: `xxx number` })
      .checkConflicts(lexer)
  ).toThrow(`Unresolved R-R conflict`);
  console.log = jest.fn();
  new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `number` })
    .define({ exp: `xxx` })
    .define({ xxx: `number` }, LR.resolveRR({ exp: `number` }, { next: `end` }))
    .define({ xxx: `xxx number` })
    .checkConflicts(lexer, true);
  expect(console.log).toHaveBeenCalledWith(
    "Unresolved R-R conflict (end of input, next: `number`): { exp: `number` } | { xxx: `number` }"
  );

  // RR conflict with next, no end of input
  expect(() =>
    new LR.ParserBuilder()
      .entry("exp")
      .define(
        { exp: `number` },
        LR.resolveRR({ xxx: `number` }, { handleEnd: true })
      )
      .define(
        { exp: `xxx` },
        LR.resolveRS({ xxx: `xxx number` }, { next: `number` })
      )
      .define({ xxx: `number` })
      .define({ xxx: `xxx number` })
      .checkConflicts(lexer)
  ).toThrow(`Unresolved R-R conflict`);
});

test("ParserBuilder check resolved", () => {
  // No such grammar rule
  expect(() =>
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `number` })
      .resolveRR({ exp: `number` }, { exp: `xxx` }, { next: `end` })
      .checkConflicts(lexer)
  ).toThrow(`No such grammar rule`);
  expect(() =>
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `number` })
      .resolveRR({ exp: `xxx` }, { exp: `number` }, { next: `end` })
      .checkConflicts(lexer)
  ).toThrow(`No such grammar rule`);

  // No next grammar
  expect(() =>
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `number` })
      .resolveRR({ exp: `number` }, { exp: `number` }, { next: `end` })
      .checkConflicts(lexer)
  ).toThrow(`not in follow set of`);

  // print all
  console.log = jest.fn();
  new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `number` })
    .resolveRR({ exp: `number` }, { exp: `xxx` }, { next: `end` })
    .checkConflicts(lexer, true);
  expect(console.log).toHaveBeenCalledWith(
    "No such grammar rule: { exp: `xxx` }"
  );
});

test("ParserBuilder generate resolver", () => {
  // RS conflict, builder style
  console.log = jest.fn();
  new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `exp '-' exp` })
    .generateResolver(lexer);
  expect(console.log).toHaveBeenCalledWith(
    ".resolveRS({ exp: `exp '-' exp` }, { exp: `exp '-' exp` }, { next: `'-'`, reduce: true })"
  );

  // RS conflict, context style
  console.log = jest.fn();
  new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `exp '-' exp` })
    .generateResolver(lexer, "context");
  expect(console.log).toHaveBeenCalledWith(
    "=== { exp: `exp '-' exp` } ===\nLR.resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })"
  );

  // RR conflict, builder style
  console.log = jest.fn();
  new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `number` })
    .define({ exp: `xxx` })
    .define({ xxx: `number` })
    .define({ xxx: `xxx number` })
    .resolveRR(
      { xxx: `number` },
      { exp: `number` },
      { next: `number`, reduce: true }
    )
    .generateResolver(lexer);
  expect(console.log).toHaveBeenCalledWith(
    ".resolveRR({ xxx: `number` }, { exp: `number` }, { handleEnd: true, reduce: true })"
  );

  // RR conflict, context style
  console.log = jest.fn();
  new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `number` })
    .define({ exp: `xxx` })
    .define({ xxx: `number` })
    .define({ xxx: `xxx number` })
    .resolveRR(
      { xxx: `number` },
      { exp: `number` },
      { next: `number`, reduce: true }
    )
    .generateResolver(lexer, "context");
  expect(console.log).toHaveBeenCalledWith(
    "=== { exp: `number` } ===\nLR.resolveRR({ xxx: `number` }, { next: `number`, handleEnd: true, reduce: true })"
  );
});

test("ParserBuilder resolve conflicts", () => {
  // RS conflict
  expect(() =>
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `exp '-' exp` })
      .resolveRS(
        { exp: `exp '-' exp` },
        { exp: `exp '-' exp` },
        { next: `'-'`, reduce: true }
      )
      .checkAll(new Set([""]), lexer)
  ).not.toThrow("Unresolved R-S conflict");

  // RR conflict
  expect(() =>
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `number` })
      .define({ exp: `xxx` })
      .define({ xxx: `number` })
      .define({ xxx: `xxx number` })
      .resolveRS(
        { exp: `xxx` },
        { xxx: `xxx number` },
        { next: `number`, reduce: true }
      )
      .resolveRR(
        { exp: `number` },
        { xxx: `number` },
        { next: `number`, handleEnd: true, reduce: true }
      )
      .resolveRR(
        { xxx: `number` },
        { exp: `number` },
        { next: `number`, handleEnd: true, reduce: true }
      )
      // .generateResolver(lexer)
      .checkConflicts(lexer)
  ).not.toThrow(`Unresolved`);

  // test rejecter
  expect(
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `number` })
      .define({ exp: `exp '-' exp` })
      .resolveRS(
        { exp: `exp '-' exp` },
        { exp: `exp '-' exp` },
        { next: `'-'`, reduce: false }
      )
      .checkAll(new Set(["number"]), lexer)
      .build()
      .parseAll(lexer.lexAll("1-1-1").map((t) => ASTNode.from(t))).accept
  ).toBe(true);

  // rejecter overload
  expect(
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `number` })
      .define(
        { exp: `exp '-' exp` },
        LR.rejecter(() => true)
      )
      .resolveRS(
        { exp: `exp '-' exp` },
        { exp: `exp '-' exp` },
        { next: `'-'`, reduce: true }
      )
      .checkAll(new Set(["number"]), lexer)
      .build()
      .parseAll(lexer.lexAll("1-1-1").map((t) => ASTNode.from(t))).accept
  ).toBe(true);
});
