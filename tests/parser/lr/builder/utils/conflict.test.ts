import { Lexer } from "../../../../../src";
import { ConflictType } from "../../../../../src/parser/LR/builder/model";
import {
  TempGrammar,
  TempGrammarType,
} from "../../../../../src/parser/LR/builder/temp-grammar";
import { getConflicts } from "../../../../../src/parser/LR/builder/utils/conflict";
import { defToTempGRs } from "../../../../../src/parser/LR/builder/utils/definition";
import { GrammarRule } from "../../../../../src/parser/LR/model";

const lexer = new Lexer.Builder()
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

test("no conflict", () => {
  expect(getConflicts(new Set(), new Set(), [], []).conflicts.size).toBe(0);
});

test("RS conflict with self", () => {
  const NTs = new Set(["exp"]);
  const grs = defToTempGRs({ exp: `number | exp '+' exp` }).map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
      })
  );
  const conflicts = getConflicts(
    new Set(["exp"]),
    NTs,
    grs,
    [],
    lexer
  ).conflicts;
  expect(conflicts.size).toBe(1);
  expect(conflicts.get(grs[0])).toBe(undefined);
  expect(conflicts.get(grs[1])!.length).toBe(1);
  expect(conflicts.get(grs[1])![0].type).toBe(ConflictType.REDUCE_SHIFT);
  expect(conflicts.get(grs[1])![0].next.length).toBe(1);
  expect(conflicts.get(grs[1])![0].next[0].content).toBe("+");
  expect(conflicts.get(grs[1])![0].anotherRule).toBe(grs[1]);
  expect(conflicts.get(grs[1])![0].handleEnd).toBe(false);
  expect(conflicts.get(grs[1])![0].length).toBe(1);
});

test("RS conflict while E is NT", () => {
  const NTs = new Set(["exp"]);
  const grs = defToTempGRs({ exp: `number | exp exp` }).map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
      })
  );
  const conflicts = getConflicts(
    new Set(["exp"]),
    NTs,
    grs,
    [],
    lexer
  ).conflicts;
  expect(conflicts.size).toBe(1);
  expect(conflicts.get(grs[0])).toBe(undefined);
  expect(conflicts.get(grs[1])!.length).toBe(1);
  expect(conflicts.get(grs[1])![0].type).toBe(ConflictType.REDUCE_SHIFT);
  expect(conflicts.get(grs[1])![0].next.length).toBe(2);
  expect(
    conflicts
      .get(grs[1])![0]
      .next.map((n) => n.content)
      .sort()
  ).toEqual(["number", "exp"].sort());
  expect(conflicts.get(grs[1])![0].anotherRule).toBe(grs[1]);
  expect(conflicts.get(grs[1])![0].handleEnd).toBe(false);
  expect(conflicts.get(grs[1])![0].length).toBe(1);
});

test("RS conflict while E is T", () => {
  const NTs = new Set(["exp"]);
  const grs = defToTempGRs({ exp: `number | number number | exp number` }).map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
      })
  );
  console.log = jest.fn();
  const conflicts = getConflicts(
    new Set(["exp"]),
    NTs,
    grs,
    [],
    lexer,
    true
  ).conflicts;
  expect(conflicts.size).toBe(1);
  expect(conflicts.get(grs[0])!.length).toBe(1);
  expect(conflicts.get(grs[0])![0].type).toBe(ConflictType.REDUCE_SHIFT);
  expect(conflicts.get(grs[0])![0].next.length).toBe(1);
  expect(conflicts.get(grs[0])![0].next.map((n) => n.content)).toEqual([
    "number",
  ]);
  expect(conflicts.get(grs[0])![0].anotherRule).toBe(grs[1]);
  expect(conflicts.get(grs[0])![0].handleEnd).toBe(false);
  expect(conflicts.get(grs[0])![0].length).toBe(1);
  expect(console.log).toBeCalledWith(
    "[auto resolve RS (DFA state)]: { exp: `number number` } | { exp: `number number` }"
  );
});

test("auto resolve RS conflict by follow set overlap", () => {
  const NTs = new Set(["exp1", "exp2"]);
  const grs = defToTempGRs({
    exp1: `'+' number '+'`,
    exp2: `'+' exp2 '-' | number`,
  }).map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
      })
  );
  console.log = jest.fn();
  const conflicts = getConflicts(
    new Set(["exp1", "exp2"]),
    NTs,
    grs,
    [],
    lexer,
    true
  ).conflicts;
  expect(conflicts.size).toBe(0);
  expect(console.log).toBeCalledWith(
    "[auto resolve RS (follow overlap)]: { exp1: `'+' number '+'` } | { exp2: `'+' exp2 '-'` }"
  );
});

test("auto resolve RS conflict by state machine states while E is NT", () => {
  const NTs = new Set(["exp1", "exp2"]);
  const grs = defToTempGRs({
    exp1: `'*' number '+' | exp1 '+'`,
    exp2: `'+' exp2 '-' | number`,
  }).map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
      })
  );
  console.log = jest.fn();
  const conflicts = getConflicts(
    new Set(["exp1", "exp2"]),
    NTs,
    grs,
    [],
    lexer,
    true
  ).conflicts;
  expect(conflicts.size).toBe(0);
  expect(console.log).toBeCalledWith(
    "[auto resolve RS (DFA state)]: { exp1: `'*' number '+'` } | { exp2: `'+' exp2 '-'` }"
  );
});

test("auto resolve RS conflict by state machine states while E is literal", () => {
  const NTs = new Set(["exp1", "exp2"]);
  const grs = defToTempGRs({
    exp1: `'*' number '+' | exp1 '-'`,
    exp2: `'+' '-'`,
  }).map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
      })
  );
  console.log = jest.fn();
  const conflicts = getConflicts(
    new Set(["exp1", "exp2"]),
    NTs,
    grs,
    [],
    lexer,
    true
  ).conflicts;
  expect(conflicts.size).toBe(0);
  expect(console.log).toBeCalledWith(
    "[auto resolve RS (DFA state)]: { exp1: `'*' number '+'` } | { exp2: `'+' '-'` }"
  );
});

test("auto resolve RR conflict by follow set overlap", () => {
  const NTs = new Set(["exp1", "exp2"]);
  const grs = defToTempGRs({
    exp1: `'+' number '+'`,
    exp2: `number '+'`,
  }).map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
      })
  );
  console.log = jest.fn();
  const conflicts = getConflicts(
    new Set(["exp1", "exp2"]),
    NTs,
    grs,
    [],
    lexer,
    true
  ).conflicts;
  expect(conflicts.size).toBe(0);
  expect(console.log).toBeCalledWith(
    "[auto resolve RR (follow overlap)]: { exp1: `'+' number '+'` } { exp2: `number '+'` }"
  );
});

test("unresolved RR", () => {
  const NTs = new Set(["exp", "A", "B"]);
  const grs = defToTempGRs({
    exp: `A number A | B number B`,
    A: `number`,
    B: `number`,
  }).map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
      })
  );
  console.log = jest.fn();
  const conflicts = getConflicts(
    new Set(["exp"]),
    NTs,
    grs,
    [],
    lexer,
    true
  ).conflicts;
  expect(conflicts.size).toBe(2);
  expect(console.log).toHaveBeenCalledWith(
    "unresolved RR: { A: `number` } | { B: `number` } next: number"
  );
});

test("resolve RR by user", () => {
  const NTs = new Set(["exp", "A", "B"]);
  const grs = defToTempGRs({
    exp: `A number A | B number B`,
    A: `number`,
    B: `number`,
  }).map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
      })
  );
  console.log = jest.fn();
  const conflicts = getConflicts(
    new Set(["exp"]),
    NTs,
    grs,
    [
      {
        reducerRule: defToTempGRs({ A: `number` })[0],
        anotherRule: defToTempGRs({ B: `number` })[0],
        next: [
          new TempGrammar({ content: "number", type: TempGrammarType.GRAMMAR }),
        ],
        type: ConflictType.REDUCE_REDUCE,
        handleEnd: false,
      },
    ],
    lexer,
    true
  ).conflicts;
  expect(conflicts.size).toBe(2);
  expect(console.log).toHaveBeenCalledWith(
    "user resolved RR: { A: `number` } | { B: `number` } next: number"
  );
});

// test("resolve RR by user with handleEnd", () => {
//   const NTs = new Set(["exp", "A", "B"]);
//   const grs = defToTempGRs({
//     exp: `A number A | B number B`,
//     A: `number`,
//     B: `number`,
//   }).map(
//     (gr) =>
//       new GrammarRule({
//         NT: gr.NT,
//         callback: gr.callback,
//         rejecter: gr.rejecter,
//         rule: gr.rule.map((g) => g.toGrammar(NTs.has(g.content))),
//       })
//   );
//   console.log = jest.fn();
//   const conflicts = getConflicts(
//     new Set(["exp"]),
//     NTs,
//     grs,
//     [
//       {
//         reducerRule: defToTempGRs({ A: `number` })[0],
//         anotherRule: defToTempGRs({ B: `number` })[0],
//         next: [
//           new TempGrammar({ content: "number", type: TempGrammarType.GRAMMAR }),
//         ],
//         type: ConflictType.REDUCE_REDUCE,
//         handleEnd: true,
//       },
//     ],
//     lexer,
//     true
//   ).conflicts;
//   expect(conflicts.size).toBe(1);
//   expect(console.log).toHaveBeenCalledWith(
//     "user resolved RR: { A: `number` } | { B: `number` } next: umber"
//   );
// });
