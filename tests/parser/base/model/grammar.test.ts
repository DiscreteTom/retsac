import {
  ASTNode,
  Grammar,
  GrammarRule,
  GrammarSet,
  GrammarType,
  Lexer,
} from "../../../../src";
import { exact } from "../../../../src/lexer";

test("Grammar.eq", () => {
  const literals = [
    new Grammar({ type: GrammarType.LITERAL, content: "123" }),
    new Grammar({ type: GrammarType.LITERAL, content: "456" }),
  ];
  const Ts = [
    new Grammar({ type: GrammarType.T, content: "number" }),
    new Grammar({ type: GrammarType.T, content: "string" }),
  ];
  const NTs = [
    new Grammar({ type: GrammarType.NT, content: "exp" }),
    new Grammar({ type: GrammarType.NT, content: "stmt" }),
  ];

  // literal
  expect(literals[0].eq(literals[0])).toBe(true);
  expect(literals[0].eq(literals[1])).toBe(false);
  expect(literals[0].eq(Ts[0])).toBe(false);
  expect(literals[0].eq(NTs[0])).toBe(false);

  // T
  expect(Ts[0].eq(Ts[0])).toBe(true);
  expect(Ts[0].eq(Ts[1])).toBe(false);
  expect(Ts[0].eq(literals[0])).toBe(false);
  expect(Ts[0].eq(NTs[0])).toBe(false);

  // NT
  expect(NTs[0].eq(NTs[0])).toBe(true);
  expect(NTs[0].eq(NTs[1])).toBe(false);
  expect(NTs[0].eq(literals[0])).toBe(false);
  expect(NTs[0].eq(Ts[0])).toBe(false);

  const literalNodes = [
    new ASTNode({ start: 0, type: "", text: "123" }),
    new ASTNode({ start: 0, type: "", text: "456" }),
  ];
  const tNodes = [Ts[0].toASTNode(), Ts[1].toASTNode()];
  const ntNodes = [NTs[0].toASTNode(), NTs[1].toASTNode()];

  // literal & nodes
  expect(literals[0].eq(literalNodes[0])).toBe(true);
  expect(literals[0].eq(literalNodes[1])).toBe(false);
  expect(literals[0].eq(tNodes[0])).toBe(false);
  expect(literals[0].eq(ntNodes[0])).toBe(false);

  // T & nodes
  expect(Ts[0].eq(tNodes[0])).toBe(true);
  expect(Ts[0].eq(tNodes[1])).toBe(false);
  expect(Ts[0].eq(literalNodes[0])).toBe(false);
  expect(Ts[0].eq(ntNodes[0])).toBe(false);

  // NT & nodes
  expect(NTs[0].eq(ntNodes[0])).toBe(true);
  expect(NTs[0].eq(ntNodes[1])).toBe(false);
  expect(NTs[0].eq(literalNodes[0])).toBe(false);
  expect(NTs[0].eq(tNodes[0])).toBe(false);
});

test("Grammar.toASTNode", () => {
  const literal = new Grammar({ type: GrammarType.LITERAL, content: "+" });
  const T = new Grammar({ type: GrammarType.T, content: "number" });
  const NT = new Grammar({ type: GrammarType.NT, content: "exp" });

  // literal with lexer
  const lexer = new Lexer.Builder()
    .define({ number: /^\d+/ })
    .anonymous(exact("+"))
    .build();
  expect(() => literal.toASTNode()).toThrow(
    `Lexer is required to parse literal grammars`
  );
  const literalNode = literal.toASTNode(lexer);
  expect(literalNode.type).toBe("");
  expect(literalNode.text).toBe("+");

  // T
  const tNode = T.toASTNode();
  expect(tNode.type).toBe("number");
  expect(tNode.text).toBe(undefined);

  // NT
  const ntNode = NT.toASTNode();
  expect(ntNode.type).toBe("exp");
  expect(ntNode.text).toBe(undefined);
});

test("Grammar.toString", () => {
  const literal = new Grammar({ type: GrammarType.LITERAL, content: "123" });
  const T = new Grammar({ type: GrammarType.T, content: "number" });

  expect(literal.toString()).toBe("'123'");
  expect(T.toString()).toBe("number");
});

test("GrammarRule.checkRSConflicts", () => {
  const rule1 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.T, content: "number" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.T, content: "number" }),
    ],
  });
  const rule2 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.T, content: "number" }),
      new Grammar({ type: GrammarType.LITERAL, content: "-" }),
      new Grammar({ type: GrammarType.T, content: "number" }),
    ],
  });
  const rule3 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.T, content: "number" }),
    ],
  });

  // single RS conflicts
  expect(rule1.checkRSConflict(rule1).length).toBe(1);
  expect(rule1.checkRSConflict(rule1)[0].length).toBe(1);
  expect(rule1.checkRSConflict(rule2).length).toBe(1);
  expect(rule1.checkRSConflict(rule2)[0].length).toBe(1);

  // looks like RS but RR conflicts
  expect(rule1.checkRSConflict(rule3).length).toBe(0);

  const rule4 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.T, content: "number" }),
      new Grammar({ type: GrammarType.T, content: "number" }),
    ],
  });
  const rule5 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.T, content: "number" }),
      new Grammar({ type: GrammarType.T, content: "number" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
    ],
  });

  // multi RS conflicts
  expect(rule4.checkRSConflict(rule5).length).toBe(2);
  expect(
    rule4
      .checkRSConflict(rule5)
      .map((c) => c.length)
      .sort()
  ).toEqual([1, 2].sort());
});

test("GrammarRule.checkRRConflicts", () => {
  const rule1 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.T, content: "number" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.T, content: "number" }),
    ],
  });
  const rule2 = new GrammarRule({
    NT: "exp",
    rule: [new Grammar({ type: GrammarType.T, content: "number" })],
  });
  const rule3 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.T, content: "number" }),
    ],
  });

  // self RR conflicts
  expect(rule1.checkRRConflict(rule1)).toBe(true);
  // normal RR conflicts
  expect(rule1.checkRRConflict(rule2)).toBe(true);
  expect(rule1.checkRRConflict(rule3)).toBe(true);
});

test("GrammarRule.toString", () => {
  const rule = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.T, content: "number" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.T, content: "number" }),
    ],
  });
  expect(rule.toString()).toBe("{ exp: `number '+' number` }");
  expect(rule.toString((NT, gs) => `${NT}: ${gs.join(" ")}`)).toBe(
    "exp: number '+' number"
  );
});

test("GrammarSet", () => {
  const gs1 = new GrammarSet();
  const gs2 = new GrammarSet();
  const g1 = new Grammar({ type: GrammarType.T, content: "number" });
  const g2 = new Grammar({ type: GrammarType.LITERAL, content: "+" });

  // add & has
  expect(gs1.has(g1)).toBe(false);
  expect(gs1.add(g1)).toBe(true);
  expect(gs1.has(g1)).toBe(true);
  expect(gs1.add(g1)).toBe(false);
  expect(gs1.has(g2)).toBe(false);

  // map
  gs1.add(g2);
  expect(gs1.map((g) => g.content).sort()).toEqual(["+", "number"].sort());

  // overlap
  gs2.add(g1);
  const overlapped = gs1.overlap(gs2);
  expect(overlapped.length).toBe(1);
  expect(overlapped[0].eq(g1)).toBe(true);
});
