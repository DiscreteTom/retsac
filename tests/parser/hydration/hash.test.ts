import { ELR, Lexer } from "../../../src";
import { HydrateHashMismatchError } from "../../../src/parser/ELR/builder/error";

test("same parser has the same hash", () => {
  const lexer = new Lexer.Builder()
    .anonymous(Lexer.whitespaces())
    .define(Lexer.wordKind(..."abcdefg"))
    .build();
  const builder = new ELR.ParserBuilder().lexer(lexer).define({
    entry: `A | B | C`,
    A: `a`,
    B: `a`,
    C: `a`,
  });
  const entry = "entry" as const;
  const options = {
    entry,
    serialize: true,
  };

  // ensure hash is the same
  expect(builder.build(options).serializable?.hash).toBe(
    builder.build(options).serializable?.hash,
  );

  // ensure build is successful
  const data = builder.build({
    entry,
    serialize: true,
  }).serializable;
  expect(() => {
    builder.build({
      entry,
      hydrate: data,
      checkHydrate: true,
    });
  }).not.toThrow();
});

test("change lexer kinds", () => {
  const builder = new ELR.ParserBuilder()
    .lexer(
      new Lexer.Builder()
        .anonymous(Lexer.whitespaces())
        .define(Lexer.wordKind(..."abcdefgh"))
        .build(),
    )
    .define({
      entry: `A | B | C`,
      A: `a`,
      B: `a`,
      C: `a`,
    });
  const entry = "entry" as const;
  const data = builder.build({
    entry,
    serialize: true,
  }).serializable;

  expect(() => {
    new ELR.ParserBuilder()
      .lexer(
        new Lexer.Builder()
          .anonymous(Lexer.whitespaces())
          .define(Lexer.wordKind(..."abcdefg")) // lexer kinds changed
          .build(),
      )
      .define({
        entry: `A | B | C`,
        A: `a`,
        B: `a`,
        C: `a`,
      })
      .build({
        entry,
        hydrate: data,
        checkHydrate: true,
      });
  }).toThrow(HydrateHashMismatchError);
});

test("change entry kinds", () => {
  const lexer = new Lexer.Builder()
    .anonymous(Lexer.whitespaces())
    .define(Lexer.wordKind(..."abcdefg"))
    .build();
  const builder = new ELR.ParserBuilder().lexer(lexer).define({
    entry: `A | B | C`,
    A: `a`,
    B: `a`,
    C: `a`,
  });
  const data = builder.build({
    entry: ["entry", "A"],
    serialize: true,
  }).serializable;

  expect(() => {
    builder.build({
      entry: "entry", // entry kinds changed
      hydrate: data,
      checkHydrate: true,
    });
  }).toThrow(HydrateHashMismatchError);
});

test("change grammar rules", () => {
  const lexer = new Lexer.Builder()
    .anonymous(Lexer.whitespaces())
    .define(Lexer.wordKind(..."abcdefg"))
    .build();
  const entry = "entry" as const;
  const builder = new ELR.ParserBuilder().lexer(lexer).define({
    entry: `A | B | C`,
    A: `a`,
    B: `a`,
    C: `a`,
  });
  const data = builder.build({
    entry,
    serialize: true,
  }).serializable;

  expect(() => {
    builder
      .define({ entry: `A A` }) // grammar rules changed
      .build({
        entry,
        hydrate: data,
        checkHydrate: true,
      });
  }).toThrow(HydrateHashMismatchError);
});

test("new resolvers", () => {
  const lexer = new Lexer.Builder()
    .anonymous(Lexer.whitespaces())
    .define(Lexer.wordKind(..."abcdefg"))
    .build();
  const entry = "entry" as const;
  const builder = new ELR.ParserBuilder().lexer(lexer).define({
    entry: `A | B | C`,
    A: `a`,
    B: `a`,
    C: `a`,
  });
  const data = builder.build({
    entry,
    serialize: true,
  }).serializable;

  expect(() => {
    builder
      .resolveRR({ A: `a` }, { B: `a` }, { handleEnd: true, accept: true }) // new resolver
      .build({
        entry,
        hydrate: data,
        checkHydrate: true,
      });
  }).toThrow(HydrateHashMismatchError);
});

test("change resolver fields", () => {
  const lexer = new Lexer.Builder()
    .anonymous(Lexer.whitespaces())
    .define(Lexer.wordKind(..."abcdefg"))
    .build();
  const entry = "entry" as const;
  const builder = new ELR.ParserBuilder()
    .lexer(lexer)
    .define({
      entry: `A | B | C`,
      A: `a`,
      B: `a`,
      C: `a`,
    })
    .resolveRR({ A: `a` }, { B: `a` }, { handleEnd: true, accept: true });
  const data = builder.build({
    entry,
    serialize: true,
  }).serializable;

  expect(() => {
    new ELR.ParserBuilder()
      .lexer(lexer)
      .define({
        entry: `A | B | C`,
        A: `a`,
        B: `a`,
        C: `a`,
      })
      .resolveRR({ A: `a` }, { B: `a` }, { handleEnd: true, accept: false }) // resolver fields changed
      .build({
        entry,
        hydrate: data,
        checkHydrate: true,
      });
  }).toThrow(HydrateHashMismatchError);
});
