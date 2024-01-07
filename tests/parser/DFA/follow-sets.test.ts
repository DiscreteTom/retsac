import { ELR, Lexer } from "../../../src";

test("build follow sets", () => {
  const { serializable } = new ELR.ParserBuilder({
    lexer: new Lexer.Builder().define(Lexer.exactKind("a", "b", "d")).build(),
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

  expect(serializable?.data.dfa.followSets.entry.sort()).toEqual([].sort());
  expect(serializable?.data.dfa.followSets.A.sort()).toEqual([].sort());
  expect(serializable?.data.dfa.followSets.B.sort()).toEqual(["a", "A"].sort());
  expect(serializable?.data.dfa.followSets.C.sort()).toEqual(["a", "A"].sort());
  expect(serializable?.data.dfa.followSets.D.sort()).toEqual(["b", "B"].sort());
  expect(serializable?.data.dfa.followSets.a.sort()).toEqual(
    ["D", "d", "C"].sort(),
  );
  expect(serializable?.data.dfa.followSets.b.sort()).toEqual(["a", "A"].sort());
  expect(serializable?.data.dfa.followSets.d.sort()).toEqual(["b", "B"].sort());
});
