import { Lexer } from "../../../../src";
import { ASTNode } from "../../../../src/parser/ast";
import { Candidate } from "../../../../src/parser/LR/DFA";
import {
  Grammar,
  GrammarRule,
  GrammarSet,
  GrammarType,
} from "../../../../src/parser/LR/model";

const gr = new GrammarRule({
  NT: "exp",
  rule: [
    new Grammar({ type: GrammarType.NT, content: "exp" }),
    new Grammar({ type: GrammarType.LITERAL, content: "+" }),
    new Grammar({ type: GrammarType.NT, content: "exp" }),
  ],
});

test("candidate basics", () => {
  const c1 = new Candidate({ gr, digested: 1 });

  expect(c1.current.content).toBe("+");
  expect(c1.canDigestMore()).toBe(true);
  expect(c1.canAccept(new ASTNode({ type: "", text: "+", start: 0 }))).toBe(
    true
  );
  expect(c1.canAccept(new ASTNode({ type: "exp", start: 0 }))).toBe(false);
  expect(c1.toString()).toBe(`exp <= exp @ '+' exp`);

  const c2 = new Candidate({ gr, digested: 3 });
  expect(c2.canDigestMore()).toBe(false);
  expect(c2.canAccept(new ASTNode({ type: "exp", start: 0 }))).toBe(false);
  expect(c2.canAccept(new ASTNode({ type: "", text: "+", start: 0 }))).toBe(
    false
  );

  const c3 = c1.next();
  expect(c3.digested == c1.digested + 1).toBe(true);
  expect(c3.gr).toBe(c1.gr);
  expect(c3.eq(c1.next())).toBe(true);

  expect(c1.tryReduce([], 0, new Set(), new Map(), true).accept).toBe(false);
});

test("candidate tryReduce", () => {
  const lexer = new Lexer.Builder()
    .define({
      number: /^[0-9]+(?:\.[0-9]+)?/,
    })
    .anonymous(Lexer.exact(..."+-*/()"))
    .build();
  const nodes = lexer.lexAll("1+1").map((t) => ASTNode.from(t));

  const gr = new GrammarRule({
    NT: "exp",
    rule: [new Grammar({ type: GrammarType.T, content: "number" })],
  });
  const c = new Candidate({ gr, digested: gr.rule.length });
  const followSets: Map<string, GrammarSet> = new Map();
  const expFollow = new GrammarSet();
  expFollow.add(new Grammar({ type: GrammarType.LITERAL, content: ")" }));
  expFollow.add(new Grammar({ type: GrammarType.LITERAL, content: "+" }));
  expFollow.add(new Grammar({ type: GrammarType.LITERAL, content: "-" }));
  expFollow.add(new Grammar({ type: GrammarType.LITERAL, content: "*" }));
  expFollow.add(new Grammar({ type: GrammarType.LITERAL, content: "/" }));
  followSets.set("exp", expFollow);

  // accept
  console.log = jest.fn();
  expect(c.tryReduce(nodes, 0, new Set(["exp"]), followSets, true).accept).toBe(
    true
  );
  expect(console.log).toHaveBeenCalledWith(`[Accept] ${gr.toString()}`);

  // follow mismatch
  console.log = jest.fn();
  expect(
    c.tryReduce([nodes[0], nodes[2]], 0, new Set(), followSets, true).accept
  ).toBe(false);
  expect(console.log).toHaveBeenCalledWith(
    `[Follow Mismatch] ${gr.toString()} follow=${nodes[2].toString()}`
  );

  // rejecter
  console.log = jest.fn();
  const grWithRejecter = new GrammarRule({
    NT: "exp",
    rule: [new Grammar({ type: GrammarType.T, content: "number" })],
    rejecter: () => true,
  });
  const cWithRejecter = new Candidate({
    gr: grWithRejecter,
    digested: gr.rule.length,
  });
  expect(
    cWithRejecter.tryReduce(nodes, 0, new Set(), followSets, true).accept
  ).toBe(false);
  expect(console.log).toHaveBeenCalledWith(
    `[Reject] ${grWithRejecter.toString()}`
  );
});
