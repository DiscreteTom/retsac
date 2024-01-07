import { ELR, Lexer } from "../../../src";

test("build first sets", () => {
  const { serializable } = new ELR.ParserBuilder({
    lexer: new Lexer.Builder().define(Lexer.wordKind("a", "b", "d")).build(),
  })
    .define({
      entry: `C A`,
      A: `a C`,
      C: `D B`,
      B: `b`,
      D: `d`,
    })
    .build({
      entry: "entry",
      serialize: true,
    });

  expect(serializable?.data.dfa.firstSets.entry.sort()).toEqual(
    ["C", "D", "d"].sort(),
  );
  expect(serializable?.data.dfa.firstSets.A.sort()).toEqual(["a"].sort());
  expect(serializable?.data.dfa.firstSets.B.sort()).toEqual(["b"].sort());
  expect(serializable?.data.dfa.firstSets.C.sort()).toEqual(["D", "d"].sort());
  expect(serializable?.data.dfa.firstSets.D.sort()).toEqual(["d"].sort());
});
