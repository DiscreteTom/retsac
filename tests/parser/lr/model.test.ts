import { ASTNode } from "../../../src/parser/ast";
import {
  Grammar,
  GrammarRule,
  GrammarSet,
  GrammarType,
} from "../../../src/parser/LR/model";

test("grammar eq", () => {
  const g1 = new Grammar({ type: GrammarType.LITERAL, content: "A" });
  const g2 = new Grammar({ type: GrammarType.LITERAL, content: "A" });
  const g3 = new Grammar({ type: GrammarType.NT, content: "A" });
  const g4 = new Grammar({ type: GrammarType.LITERAL, content: "B" });

  expect(g1.eq(g2)).toBe(true);
  expect(g1.eq(g3)).toBe(false);
  expect(g1.eq(g4)).toBe(false);

  const node1 = new ASTNode({ type: "", text: "A", start: 0 });
  const node2 = new ASTNode({ type: "A", text: "", start: 0 });

  expect(g1.eq(node1)).toBe(true);
  expect(g1.eq(node2)).toBe(false);
  expect(g3.eq(node2)).toBe(true);
});

test("grammar toString", () => {
  const g1 = new Grammar({ type: GrammarType.LITERAL, content: "A" });
  const g2 = new Grammar({ type: GrammarType.NT, content: "A" });

  expect(g1.toString()).toBe("'A'");
  expect(g2.toString()).toBe("A");
});

test("grammar rule constructor", () => {
  const gr = new GrammarRule({
    rule: [new Grammar({ type: GrammarType.NT, content: "exp" })],
    NT: "A",
  });

  expect(gr.callback).toBeDefined();
  expect(gr.rejecter).toBeDefined();

  const gr2 = new GrammarRule({
    rule: [new Grammar({ type: GrammarType.NT, content: "exp" })],
    NT: "A",
    callback: (ctx) => 123,
    rejecter: (ctx) => true,
  });

  expect(gr2.callback({ matched: [], before: [], after: [] })).toBe(123);
  expect(gr2.rejecter({ matched: [], before: [], after: [] })).toBe(true);
});

test("grammar rule checkRSConflict", () => {
  const gr1 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.NT, content: "exp" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.NT, content: "exp" }),
    ],
  });
  const gr2 = new GrammarRule({
    NT: "exp",
    rule: [new Grammar({ type: GrammarType.LITERAL, content: "+" })],
  });

  expect(gr1.checkRSConflict(gr1).map((c) => c.length)).toEqual([1]);
  expect(gr1.checkRSConflict(gr2).map((c) => c.length)).toEqual([]);
});

test("grammar rule checkRRConflict", () => {
  const gr1 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.NT, content: "exp" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.NT, content: "exp" }),
    ],
  });
  const gr2 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.NT, content: "exp" }),
    ],
  });
  const gr3 = new GrammarRule({
    NT: "exp",
    rule: [new Grammar({ type: GrammarType.LITERAL, content: "+" })],
  });

  expect(gr1.checkRRConflict(gr2)).toBe(true);
  expect(gr1.checkRRConflict(gr3)).toBe(false);
  expect(gr3.checkRRConflict(gr1)).toBe(false);
});

test("grammar rule toString", () => {
  const gr1 = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.NT, content: "exp" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.NT, content: "exp" }),
    ],
  });

  expect(gr1.toString()).toBe(`{ exp: \`exp '+' exp\` }`);
  expect(gr1.toString((NT, grammars) => `${NT}: ${grammars.join(" ")}`)).toBe(
    `exp: exp '+' exp`
  );
});

test("grammar set", () => {
  const g1 = new Grammar({ type: GrammarType.LITERAL, content: "A" });
  const g2 = new Grammar({ type: GrammarType.NT, content: "B" });
  const g3 = new Grammar({ type: GrammarType.LITERAL, content: "A" });

  const gs = new GrammarSet();
  gs.add(g1);
  gs.add(g2);

  expect(gs.has(g1)).toBe(true);
  expect(gs.has(g2)).toBe(true);
  expect(gs.has(g3)).toBe(true);
  expect(gs.add(g3)).toBe(false);

  expect(gs.map((g) => g.content).sort()).toEqual(["A", "B"].sort());

  expect(
    gs
      .overlap(gs)
      .map((g) => g.content)
      .sort()
  ).toEqual(["A", "B"].sort());
});
