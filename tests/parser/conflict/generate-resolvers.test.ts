import { ELR, Lexer } from "../../../src";

describe.each(["builder", "context"] as const)("generate resolvers", (mode) => {
  test("one RS conflict", () => {
    const { resolvers } = new ELR.ParserBuilder({
      lexer: new Lexer.Builder()
        .anonymous(Lexer.whitespaces())
        .define(Lexer.wordKind(..."abcdefg"))
        .build(),
    })
      .define({
        entry: `E d | F`,
        E: `a b c`,
        F: `a b c d`,
      })
      .build({
        entry: "entry",
        generateResolvers: mode,
      });

    if (mode === "builder") {
      expect(resolvers).toBe(
        ".resolveRS({ E: `a b c` }, { F: `a b c d` }, { next: `d`, accept: TODO })",
      );
    } else {
      expect(resolvers).toBe(
        [
          `=== GrammarRule({"NT":"E","rule":["a","b","c"]}) ===`,
          "ELR.resolveRS({ F: `a b c d` }, { next: `d`, accept: TODO })",
        ].join("\n"),
      );
    }
  });

  test("multi RS conflict", () => {
    const { resolvers } = new ELR.ParserBuilder({
      lexer: new Lexer.Builder()
        .anonymous(Lexer.whitespaces())
        .define(Lexer.wordKind(..."abcdefg"))
        .build(),
    })
      .define({
        entry: `E d | F | G c d`,
        E: `a b c`,
        F: `a b c d`,
        G: `a b`,
      })
      .build({
        entry: "entry",
        generateResolvers: mode,
      });

    if (mode === "builder") {
      expect(resolvers).toBe(
        [
          ".resolveRS({ E: `a b c` }, { F: `a b c d` }, { next: `d`, accept: TODO })",
          ".resolveRS({ G: `a b` }, { E: `a b c` }, { next: `c`, accept: TODO })",
          ".resolveRS({ G: `a b` }, { F: `a b c d` }, { next: `c`, accept: TODO })",
        ].join("\n"),
      );
    } else {
      expect(resolvers).toBe(
        [
          `=== GrammarRule({"NT":"E","rule":["a","b","c"]}) ===`,
          "ELR.resolveRS({ F: `a b c d` }, { next: `d`, accept: TODO })",
          "",
          `=== GrammarRule({"NT":"G","rule":["a","b"]}) ===`,
          "ELR.resolveRS({ E: `a b c` }, { next: `c`, accept: TODO }),",
          "ELR.resolveRS({ F: `a b c d` }, { next: `c`, accept: TODO })",
        ].join("\n"),
      );
    }
  });

  test("one RR conflict", () => {
    const { resolvers } = new ELR.ParserBuilder({
      lexer: new Lexer.Builder()
        .anonymous(Lexer.whitespaces())
        .define(Lexer.wordKind(..."abcdefg"))
        .build(),
    })
      .define({
        entry: `A b | B b`,
        A: `a`,
        B: `a`,
      })
      .build({
        entry: "entry",
        generateResolvers: mode,
      });

    if (mode === "builder") {
      expect(resolvers).toBe(
        [
          ".resolveRR({ A: `a` }, { B: `a` }, { next: `b`, accept: TODO })",
          ".resolveRR({ B: `a` }, { A: `a` }, { next: `b`, accept: TODO })",
        ].join("\n"),
      );
    } else {
      expect(resolvers).toBe(
        [
          `=== GrammarRule({"NT":"A","rule":["a"]}) ===`,
          "ELR.resolveRR({ B: `a` }, { next: `b`, accept: TODO })",
          "",
          `=== GrammarRule({"NT":"B","rule":["a"]}) ===`,
          "ELR.resolveRR({ A: `a` }, { next: `b`, accept: TODO })",
        ].join("\n"),
      );
    }
  });

  test("one RR conflict, handle end", () => {
    const { resolvers } = new ELR.ParserBuilder({
      lexer: new Lexer.Builder()
        .anonymous(Lexer.whitespaces())
        .define(Lexer.wordKind(..."abcdefg"))
        .build(),
    })
      .define({
        entry: `A | B`,
        A: `a`,
        B: `a`,
      })
      .build({
        entry: "entry",
        generateResolvers: mode,
      });

    if (mode === "builder") {
      expect(resolvers).toBe(
        [
          ".resolveRR({ A: `a` }, { B: `a` }, { handleEnd: true, accept: TODO })",
          ".resolveRR({ B: `a` }, { A: `a` }, { handleEnd: true, accept: TODO })",
        ].join("\n"),
      );
    } else {
      expect(resolvers).toBe(
        [
          `=== GrammarRule({"NT":"A","rule":["a"]}) ===`,
          "ELR.resolveRR({ B: `a` }, { handleEnd: true, accept: TODO })",
          "",
          `=== GrammarRule({"NT":"B","rule":["a"]}) ===`,
          "ELR.resolveRR({ A: `a` }, { handleEnd: true, accept: TODO })",
        ].join("\n"),
      );
    }
  });

  test("multi RR conflict", () => {
    const { resolvers } = new ELR.ParserBuilder({
      lexer: new Lexer.Builder()
        .anonymous(Lexer.whitespaces())
        .define(Lexer.wordKind(..."abcdefg"))
        .build(),
    })
      .define({
        entry: `A b | B b | C b`,
        A: `a`,
        B: `a`,
        C: `a`,
      })
      .build({
        entry: "entry",
        generateResolvers: mode,
      });

    if (mode === "builder") {
      expect(resolvers).toBe(
        [
          ".resolveRR({ A: `a` }, { B: `a` }, { next: `b`, accept: TODO })",
          ".resolveRR({ A: `a` }, { C: `a` }, { next: `b`, accept: TODO })",
          ".resolveRR({ B: `a` }, { A: `a` }, { next: `b`, accept: TODO })",
          ".resolveRR({ B: `a` }, { C: `a` }, { next: `b`, accept: TODO })",
          ".resolveRR({ C: `a` }, { A: `a` }, { next: `b`, accept: TODO })",
          ".resolveRR({ C: `a` }, { B: `a` }, { next: `b`, accept: TODO })",
        ].join("\n"),
      );
    } else {
      expect(resolvers).toBe(
        [
          `=== GrammarRule({"NT":"A","rule":["a"]}) ===`,
          "ELR.resolveRR({ B: `a` }, { next: `b`, accept: TODO }),",
          "ELR.resolveRR({ C: `a` }, { next: `b`, accept: TODO })",
          "",
          `=== GrammarRule({"NT":"B","rule":["a"]}) ===`,
          "ELR.resolveRR({ A: `a` }, { next: `b`, accept: TODO }),",
          "ELR.resolveRR({ C: `a` }, { next: `b`, accept: TODO })",
          "",
          `=== GrammarRule({"NT":"C","rule":["a"]}) ===`,
          "ELR.resolveRR({ A: `a` }, { next: `b`, accept: TODO }),",
          "ELR.resolveRR({ B: `a` }, { next: `b`, accept: TODO })",
        ].join("\n"),
      );
    }
  });

  test("multi RR conflict, handle end", () => {
    const { resolvers } = new ELR.ParserBuilder({
      lexer: new Lexer.Builder()
        .anonymous(Lexer.whitespaces())
        .define(Lexer.wordKind(..."abcdefg"))
        .build(),
    })
      .define({
        entry: `A | B | C`,
        A: `a`,
        B: `a`,
        C: `a`,
      })
      .build({
        entry: "entry",
        generateResolvers: mode,
      });

    if (mode === "builder") {
      expect(resolvers).toBe(
        [
          ".resolveRR({ A: `a` }, { B: `a` }, { handleEnd: true, accept: TODO })",
          ".resolveRR({ A: `a` }, { C: `a` }, { handleEnd: true, accept: TODO })",
          ".resolveRR({ B: `a` }, { A: `a` }, { handleEnd: true, accept: TODO })",
          ".resolveRR({ B: `a` }, { C: `a` }, { handleEnd: true, accept: TODO })",
          ".resolveRR({ C: `a` }, { A: `a` }, { handleEnd: true, accept: TODO })",
          ".resolveRR({ C: `a` }, { B: `a` }, { handleEnd: true, accept: TODO })",
        ].join("\n"),
      );
    } else {
      expect(resolvers).toBe(
        [
          `=== GrammarRule({"NT":"A","rule":["a"]}) ===`,
          "ELR.resolveRR({ B: `a` }, { handleEnd: true, accept: TODO }),",
          "ELR.resolveRR({ C: `a` }, { handleEnd: true, accept: TODO })",
          "",
          `=== GrammarRule({"NT":"B","rule":["a"]}) ===`,
          "ELR.resolveRR({ A: `a` }, { handleEnd: true, accept: TODO }),",
          "ELR.resolveRR({ C: `a` }, { handleEnd: true, accept: TODO })",
          "",
          `=== GrammarRule({"NT":"C","rule":["a"]}) ===`,
          "ELR.resolveRR({ A: `a` }, { handleEnd: true, accept: TODO }),",
          "ELR.resolveRR({ B: `a` }, { handleEnd: true, accept: TODO })",
        ].join("\n"),
      );
    }
  });
});
