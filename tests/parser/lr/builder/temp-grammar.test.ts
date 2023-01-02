import { ASTNode } from "../../../../src/parser";
import {
  TempGrammar,
  TempGrammarRule,
  TempGrammarType,
} from "../../../../src/parser/LR/builder/temp-grammar";
import {
  Grammar,
  GrammarType,
  GrammarRule,
} from "../../../../src/parser/LR/model";

test("TempGrammar <=> Grammar", () => {
  // grammar to temp-grammar
  expect(
    TempGrammar.from(
      new Grammar({ type: GrammarType.LITERAL, content: "+" })
    ).eq(new TempGrammar({ type: TempGrammarType.LITERAL, content: "+" }))
  ).toBe(true);
  expect(
    TempGrammar.from(new Grammar({ type: GrammarType.NT, content: "exp" })).eq(
      new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "exp" })
    )
  ).toBe(true);
  expect(
    TempGrammar.from(
      new Grammar({ type: GrammarType.T, content: "number" })
    ).eq(new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "number" }))
  ).toBe(true);

  // temp-grammar to grammar
  expect(
    new TempGrammar({ type: TempGrammarType.LITERAL, content: "+" })
      .toGrammar()
      .eq(new Grammar({ type: GrammarType.LITERAL, content: "+" }))
  ).toBe(true);
  expect(
    new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "exp" })
      .toGrammar(true)
      .eq(new Grammar({ type: GrammarType.NT, content: "exp" }))
  ).toBe(true);
  expect(
    new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "number" })
      .toGrammar(false)
      .eq(new Grammar({ type: GrammarType.T, content: "number" }))
  ).toBe(true);
});

test("TempGrammar equality", () => {
  const literal = new TempGrammar({
    type: TempGrammarType.LITERAL,
    content: "+",
  });
  const grammar = new TempGrammar({
    type: TempGrammarType.GRAMMAR,
    content: "exp",
  });

  expect(literal.eq(literal)).toBe(true);
  expect(literal.eq(grammar)).toBe(false);
  expect(literal.eq(literal.toGrammar())).toBe(true);
  expect(literal.eq(grammar.toGrammar())).toBe(false);
  expect(grammar.eq(grammar.toGrammar())).toBe(true);
  expect(grammar.eq(literal.toGrammar())).toBe(false);

  const literalNode = new ASTNode({ type: "", text: "+", start: 0 });
  const grammarNode = new ASTNode({ type: "exp", start: 0 });
  expect(literal.eq(literalNode)).toBe(true);
  expect(literal.eq(grammarNode)).toBe(false);
  expect(grammar.eq(grammarNode)).toBe(true);
  expect(grammar.eq(literalNode)).toBe(false);
});

test("TempGrammarRule weakEq", () => {
  const rule = new TempGrammarRule({
    NT: "exp",
    rule: [
      new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "exp" }),
      new TempGrammar({ type: TempGrammarType.LITERAL, content: "+" }),
      new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "exp" }),
    ],
  });

  expect(rule.weakEq(rule)).toBe(true);
  expect(
    rule.weakEq(
      new TempGrammarRule({
        NT: rule.NT,
        rule: rule.rule,
        callback: () => {},
        rejecter: () => false,
      })
    )
  ).toBe(true);
  expect(rule.weakEq(new TempGrammarRule({ NT: rule.NT, rule: [] }))).toBe(
    false
  );
  expect(
    rule.weakEq(new TempGrammarRule({ NT: rule.NT, rule: rule.rule.slice(1) }))
  ).toBe(false);
  expect(rule.weakEq(new TempGrammarRule({ NT: "abc", rule: rule.rule }))).toBe(
    false
  );
});

test("TempGrammarRule to string", () => {
  const rule = new TempGrammarRule({
    NT: "exp",
    rule: [
      new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "exp" }),
      new TempGrammar({ type: TempGrammarType.LITERAL, content: "+" }),
      new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "exp" }),
    ],
  });

  const gRule = new GrammarRule({
    NT: "exp",
    rule: [
      new Grammar({ type: GrammarType.NT, content: "exp" }),
      new Grammar({ type: GrammarType.LITERAL, content: "+" }),
      new Grammar({ type: GrammarType.NT, content: "exp" }),
    ],
  });

  expect(rule.toString()).toBe(gRule.toString());
});
