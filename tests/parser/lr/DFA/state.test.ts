import { Lexer } from "../../../../src";
import { ASTNode } from "../../../../src/parser";
import { Candidate, State } from "../../../../src/parser/LR/DFA";
import {
  GrammarRule,
  Grammar,
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

test("state basics", () => {
  const s = new State([new Candidate({ gr, digested: 0 })]);

  expect(s.eq(s)).toBe(true);
  expect(s.contains(gr, 0)).toBe(true);
  expect(s.contains(gr, 1)).toBe(false);
});

test("state tryReduce", () => {
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
  const s = new State([new Candidate({ gr, digested: gr.rule.length })]);

  expect(s.tryReduce(nodes, 2, new Set(["exp"]), new Map(), false).accept).toBe(
    true
  );

  expect(
    new State([]).tryReduce(nodes, 0, new Set(["exp"]), new Map(), false).accept
  ).toBe(false);
});
