import { ELR, Lexer } from "../../../src";
import type { Definition } from "../../../src/parser/ELR";

// 'if a grammar rule wants to reduce while another grammar rule wants to shift, then it's a RS conflict'
// e.g.: the following state:
// E := A B C #
// F := A B C # D
// the first grammar rule wants to reduce, but the second grammar rule want to shift.
// if the follow of E overlap with the first of C, there is a RS conflict.

// however, people might think that
// 'if a grammar rule starts with another grammar rule, there might be a RS conflict'
// in the above example, `A B C D` starts with `A B C`, so there might be a RS conflict.

// in fact, the `starts with` is not a necessary condition for RS conflict.
// consider the following state:
// E := B C #
// F := A B C # D
// there still might be a RS conflict, even though `A B C` does not start with `B C`.
// further more:
// E := C #
// F := A B C # D
// as you can see, there still might be a RS conflict.
// what's more:
// E := A B C #
// F := C # D
// you may found that checking RS conflicts using grammar rules is not a good idea.

// so, starts with v0.12.0, we check candidates in each state to find RS conflicts.

function expectRSConflict<Kinds extends string>(
  defs: Definition<Kinds | "entry">,
  conflicts: { reducerNT: Kinds; anotherNT: Kinds }[],
) {
  const { serializable } = new ELR.ParserBuilder({
    lexer: new Lexer.Builder()
      .anonymous(Lexer.whitespaces())
      .define(Lexer.wordKind(..."abcdefg"))
      .build(),
  })
    .define(defs)
    .build({
      entry: "entry",
      serialize: true,
      // don't check all, store conflicts in grammar rules
      // and access conflicts using serializable
      // checkAll: true,
    });

  conflicts.forEach((c) => {
    expect(
      serializable!.data.dfa.grammarRules
        .find((rule) => rule.NT === c.reducerNT)!
        .conflicts.find(
          (cc) =>
            cc.type === ELR.ConflictType.REDUCE_SHIFT &&
            cc.anotherRule.startsWith(`{ ${c.anotherNT}`),
        ),
    ).not.toBeUndefined();
  });
}

test("'starts with' rs conflicts", () => {
  expectRSConflict(
    {
      entry: `E d | F`,
      E: `a b c`,
      F: `a b c d`,
    },
    [
      {
        reducerNT: "E",
        anotherNT: "F",
      },
    ],
  );
});

test("other rs conflicts", () => {
  expectRSConflict(
    {
      entry: `a E d | F`,
      E: `b c`,
      F: `a b c d`,
    },
    [
      {
        reducerNT: "E",
        anotherNT: "F",
      },
    ],
  );

  expectRSConflict(
    {
      entry: `a b E d | F`,
      E: `c`,
      F: `a b c d`,
    },
    [
      {
        reducerNT: "E",
        anotherNT: "F",
      },
    ],
  );

  expectRSConflict(
    {
      entry: `E d | a b F`,
      E: `a b c`,
      F: `c d`,
    },
    [
      {
        reducerNT: "E",
        anotherNT: "F",
      },
    ],
  );
});
