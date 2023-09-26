import { ELR, Lexer } from "../../../src";
import { ConflictError } from "../../../src/parser/ELR/builder/error";

// resolvers should be applied in the order they are defined
// no matter they are defined in grammar rule context or in the builder

// for the test, we define the following grammar rules:
// exp: `num | exp num | num num`
// there will be a RS conflict between exp: `num` and exp: `num num`.
// for example, to parse `num num`, there will be two possible parse paths:
// 1. exp -> num num
// 2. exp -> exp num -> num num

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces())
  .define(Lexer.wordKind("num"))
  .build();

test("no resolver", () => {
  // if no resolver, throw error
  expect(() =>
    new ELR.ParserBuilder()
      .define({ exp: `num` })
      .define({ exp: `num num` })
      .define({ exp: `exp num` })
      .entry("exp")
      .build({
        lexer: lexer.dryClone(),
        checkAll: true,
        // debug: true,
      })
      .parser.parse("num num"),
  ).toThrow(ConflictError);
});

test("2 in grammar rule context, accept", () => {
  // 2 resolvers in grammar rule context, the first one will be applied
  let result = 0;
  new ELR.ParserBuilder()
    .define(
      { exp: `num` },
      ELR.callback(() => (result = 1)),
      ELR.resolveRS({ exp: `num num` }, { next: `*`, accept: true }),
      ELR.resolveRS({ exp: `num num` }, { next: `*`, accept: false }),
    )
    .define(
      { exp: `num num` },
      ELR.callback(() => (result = 2)),
    )
    .define({ exp: `exp num` })
    .entry("exp")
    .build({
      lexer: lexer.dryClone(),
      checkAll: true,
      // debug: true,
    })
    .parser.parse("num num");
  expect(result).toBe(1);
});

test("2 in grammar rule context, reject", () => {
  let result = 0;
  new ELR.ParserBuilder()
    .define(
      { exp: `num` },
      ELR.callback(() => (result = 1)),
      ELR.resolveRS({ exp: `num num` }, { next: `*`, accept: false }),
      ELR.resolveRS({ exp: `num num` }, { next: `*`, accept: true }),
    )
    .define(
      { exp: `num num` },
      ELR.callback(() => (result = 2)),
    )
    .define({ exp: `exp num` })
    .entry("exp")
    .build({
      lexer: lexer.dryClone(),
      checkAll: true,
      // debug: true,
    })
    .parser.parse("num num");
  expect(result).toBe(2);
});

test("2 in builder, accept", () => {
  // 2 resolvers in builder, the first one will be applied
  let result = 0;
  new ELR.ParserBuilder()
    .define(
      { exp: `num` },
      ELR.callback(() => (result = 1)),
    )
    .define(
      { exp: `num num` },
      ELR.callback(() => (result = 2)),
    )
    .define({ exp: `exp num` })
    .resolveRS({ exp: `num` }, { exp: `num num` }, { next: `*`, accept: true })
    .resolveRS({ exp: `num` }, { exp: `num num` }, { next: `*`, accept: false })
    .entry("exp")
    .build({
      lexer: lexer.dryClone(),
      checkAll: true,
      // debug: true,
    })
    .parser.parse("num num");
  expect(result).toBe(1);
});

test("2 in builder, reject", () => {
  let result = 0;
  new ELR.ParserBuilder()
    .define(
      { exp: `num` },
      ELR.callback(() => (result = 1)),
    )
    .define(
      { exp: `num num` },
      ELR.callback(() => (result = 2)),
    )
    .define({ exp: `exp num` })
    .resolveRS({ exp: `num` }, { exp: `num num` }, { next: `*`, accept: false })
    .resolveRS({ exp: `num` }, { exp: `num num` }, { next: `*`, accept: true })
    .entry("exp")
    .build({
      lexer: lexer.dryClone(),
      checkAll: true,
      // debug: true,
    })
    .parser.parse("num num");
  expect(result).toBe(2);
});

test("1 in grammar rule context, 1 in builder, accept", () => {
  // 1 resolver in grammar rule context, 1 resolver in builder, the first one will be applied
  let result = 0;
  new ELR.ParserBuilder()
    .define(
      { exp: `num` },
      ELR.callback(() => (result = 1)),
      ELR.resolveRS({ exp: `num num` }, { next: `*`, accept: true }),
    )
    .define(
      { exp: `num num` },
      ELR.callback(() => (result = 2)),
    )
    .define({ exp: `exp num` })
    .resolveRS({ exp: `num` }, { exp: `num num` }, { next: `*`, accept: false })
    .entry("exp")
    .build({
      lexer: lexer.dryClone(),
      checkAll: true,
      // debug: true,
    })
    .parser.parse("num num");
  expect(result).toBe(1);
});

test("1 in grammar rule context, 1 in builder, reject", () => {
  let result = 0;
  new ELR.ParserBuilder()
    .define(
      { exp: `num` },
      ELR.callback(() => (result = 1)),
      ELR.resolveRS({ exp: `num num` }, { next: `*`, accept: false }),
    )
    .define(
      { exp: `num num` },
      ELR.callback(() => (result = 2)),
    )
    .define({ exp: `exp num` })
    .resolveRS({ exp: `num` }, { exp: `num num` }, { next: `*`, accept: true })
    .entry("exp")
    .build({
      lexer: lexer.dryClone(),
      checkAll: true,
      // debug: true,
    })
    .parser.parse("num num");
  expect(result).toBe(2);
});
