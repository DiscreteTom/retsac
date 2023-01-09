import { Lexer } from "../../../../src";
import { ASTNode } from "../../../../src/parser";
import { Candidate } from "../../../../src/parser/LR/DFA/candidate";
import { State } from "../../../../src/parser/LR/DFA/state";
import {
  GrammarRule,
  Grammar,
  GrammarType,
} from "../../../../src/parser/LR/model";

test("state basics", () => {
  const gr = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.NT, content: "exp" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.NT, content: "exp" }),
    ],
  });
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
  const entryNTs = new Set(["exp"]);
  const followSets = new Map();

  expect(s.tryReduce(nodes, 2, entryNTs, followSets, false).accept).toBe(true);

  expect(
    new State([]).tryReduce(nodes, 0, entryNTs, followSets, false).accept
  ).toBe(false);
});
