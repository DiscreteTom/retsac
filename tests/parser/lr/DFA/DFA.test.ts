import { Lexer } from "../../../../src";
import { ASTNode } from "../../../../src/parser";
import { DFA } from "../../../../src/parser/LR/DFA";
import { Candidate } from "../../../../src/parser/LR/DFA/candidate";
import { State } from "../../../../src/parser/LR/DFA/state";
import {
  GrammarRule,
  Grammar,
  GrammarType,
} from "../../../../src/parser/LR/model";

const lexer = new Lexer.Builder()
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

const grs = [
  new GrammarRule({
    NT: "exp",
    rule: [new Grammar({ type: GrammarType.T, content: "number" })],
  }),
  new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.NT, content: "exp" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.NT, content: "exp" }),
    ],
  }),
];

const dfa = new DFA(grs, new Set(["exp"]), new Set(["exp"]));

test("DFA basics", () => {
  // check first sets
  expect(
    dfa
      .getFirstSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.T, content: "number" }))
  ).toBe(true);

  expect(
    dfa
      .getFirstSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.NT, content: "exp" }))
  ).toBe(true);

  expect(
    dfa
      .getFirstSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.LITERAL, content: "+" }))
  ).toBe(false);

  expect(dfa.getFirstSets().get("number")).toBe(undefined);
  expect(dfa.getFirstSets().get("+")).toBe(undefined);

  // check follow sets
  expect(
    dfa
      .getFollowSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.T, content: "number" }))
  ).toBe(false);

  expect(
    dfa
      .getFollowSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.NT, content: "exp" }))
  ).toBe(false);

  expect(
    dfa
      .getFollowSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.LITERAL, content: "+" }))
  ).toBe(true);

  expect(dfa.getFollowSets().get("number")).toBe(undefined);
  expect(dfa.getFollowSets().get("+")).toBe(undefined);
});

test("DFA parse", () => {
  console.log = jest.fn();
  dfa.debug = true;

  const nodes = lexer.lexAll("1+1").map((t) => ASTNode.from(t));

  // first parse, `number '+' number` to `exp '+' number`
  const res = dfa.parse(nodes);

  expect(res.accept).toBe(true);
  if (res.accept) {
    expect(res.buffer[0].type).toBe("exp");
    expect(res.buffer[0].children![0].type).toBe("number");
    expect(res.buffer[0].children![0].text).toBe("1");
    expect(res.buffer[1].type).toBe(""); // anonymous
    expect(res.buffer[1].text).toBe("+");
    expect(res.buffer[2].type).toBe("number");
    expect(res.buffer[2].text).toBe("1");

    // second parse, `exp '+' number` to `exp '+' exp` then `exp`
    const res2 = dfa.parse(res.buffer);

    expect(res2.accept).toBe(true);
    if (res2.accept) {
      expect(res2.buffer.length).toBe(1);
      expect(res2.buffer[0].type).toBe("exp");
      expect(res2.buffer[0].children![0].type).toBe("exp");
      expect(res2.buffer[0].children![0].children![0].type).toBe("number");
      expect(res2.buffer[0].children![0].children![0].text).toBe("1");
      expect(res2.buffer[0].children![1].type).toBe(""); // anonymous
      expect(res2.buffer[0].children![1].text).toBe("+");
      expect(res2.buffer[0].children![2].type).toBe("exp");
      expect(res2.buffer[0].children![2].children![0].type).toBe("number");
      expect(res2.buffer[0].children![2].children![0].text).toBe("1");
    }
  }

  // failed parse
  const res3 = dfa.parse(nodes.slice(1)); // `+1`
  expect(res3.accept).toBe(false);
  const res4 = dfa.parse(nodes.slice(0, -1)); // `1+`
  expect(res4.accept).toBe(true); // first parse, `number '+'` to `exp '+'`
  if (res4.accept) {
    const res5 = dfa.parse(res4.buffer); // second parse, should fail since input is not complete
    expect(res5.accept).toBe(false);
  }
});

test("DFA all states", () => {
  const states = [
    new State([
      // `exp <= @ number`
      new Candidate({ gr: grs[0], digested: 0 }),
      // `exp <= @ exp '+' exp`
      new Candidate({ gr: grs[1], digested: 0 }),
    ]),
    new State([
      // `exp <= number @`
      new Candidate({ gr: grs[0], digested: 1 }),
    ]),
    new State([
      // `exp <= exp @ '+' exp`
      new Candidate({ gr: grs[1], digested: 1 }),
    ]),
    new State([
      // `exp <= exp '+' @ exp`
      new Candidate({ gr: grs[1], digested: 2 }),
      // `exp <= @ number`
      new Candidate({ gr: grs[0], digested: 0 }),
      // `exp <= @ exp '+' exp`
      new Candidate({ gr: grs[1], digested: 0 }),
    ]),
    new State([
      // `exp <= exp '+' exp @`
      new Candidate({ gr: grs[1], digested: 3 }),
      // `exp <= exp @ '+' exp`
      new Candidate({ gr: grs[1], digested: 1 }),
    ]),
  ];

  expect(() => dfa.calculateAllStates()).toThrow(
    "Lexer is required to parse literal grammars."
  );

  const computedStates = dfa.calculateAllStates(lexer).getAllStates();
  expect(computedStates.length).toBe(states.length);
  expect(computedStates.every((s) => states.some((ss) => ss.eq(s)))).toBe(true);
  expect(states.every((s) => computedStates.some((ss) => ss.eq(s)))).toBe(true);
});

test("DFA grammar closure", () => {
  const grs = [
    new GrammarRule({
      NT: "exp",
      rule: [new Grammar({ type: GrammarType.NT, content: "subExp" })],
    }),
    new GrammarRule({
      NT: "subExp",
      rule: [new Grammar({ type: GrammarType.T, content: "number" })],
    }),
  ];

  const dfa = new DFA(grs, new Set(["exp"]), new Set(["exp", "subExp"]));

  // check first sets
  expect(
    dfa
      .getFirstSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.T, content: "number" }))
  ).toBe(true);
  expect(
    dfa
      .getFirstSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.NT, content: "subExp" }))
  ).toBe(true);
  expect(
    dfa
      .getFirstSets()
      .get("subExp")
      ?.has(new Grammar({ type: GrammarType.T, content: "number" }))
  ).toBe(true);
});

test("DFA complex follow set", () => {
  const grs = [
    new GrammarRule({
      NT: "exp",
      rule: [new Grammar({ type: GrammarType.T, content: "number" })],
    }),
    new GrammarRule({
      NT: "exp",
      rule: [
        new Grammar({ type: GrammarType.NT, content: "exp" }),
        new Grammar({ type: GrammarType.LITERAL, content: "+" }),
        new Grammar({ type: GrammarType.NT, content: "exp" }),
      ],
    }),
    new GrammarRule({
      NT: "exp",
      rule: [
        // NT follows NT
        new Grammar({ type: GrammarType.NT, content: "exp" }),
        new Grammar({ type: GrammarType.NT, content: "exp" }),
      ],
    }),
  ];

  const dfa = new DFA(grs, new Set(["exp"]), new Set(["exp"]));

  expect(
    dfa
      .getFollowSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.T, content: "number" }))
  ).toBe(true);
  expect(
    dfa
      .getFollowSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.NT, content: "exp" }))
  ).toBe(true);
  expect(
    dfa
      .getFollowSets()
      .get("exp")
      ?.has(new Grammar({ type: GrammarType.LITERAL, content: "+" }))
  ).toBe(true);
});

test("DFA parse stop on error", () => {
  let count = 0;
  const grs = [
    new GrammarRule({
      NT: "exp",
      rule: [new Grammar({ type: GrammarType.T, content: "number" })],
      callback: (ctx) => {
        // stop parse when the second number is encountered
        count++;
        if (count === 2) {
          ctx.error = "error";
        }
      },
    }),
    new GrammarRule({
      NT: "exp",
      rule: [
        new Grammar({ type: GrammarType.NT, content: "exp" }),
        new Grammar({ type: GrammarType.LITERAL, content: "+" }),
        new Grammar({ type: GrammarType.NT, content: "exp" }),
      ],
    }),
  ];

  const dfa = new DFA(grs, new Set(["exp"]), new Set(["exp"]));
  const nodes = lexer.lexAll("1+1").map((t) => ASTNode.from(t));

  // first parse, `number '+' number` to `exp '+' number`
  const res = dfa.parse(nodes);
  if (res.accept) {
    // second parse, `exp '+' number` to `exp '+' exp`, callback will set error
    const res2 = dfa.parse(res.buffer, true);
    expect(res2.accept).toBe(true);
    if (res2.accept) {
      expect(res2.buffer.length).toBe(3); // `exp '+' exp`
      expect(res2.buffer[0].type).toBe("exp");
      expect(res2.buffer[1].type).toBe("");
      expect(res2.buffer[2].type).toBe("exp");
      expect(res2.errors.length).toBe(1);
      expect(res2.errors[0].error).toBe("error");
    }
  }
});
