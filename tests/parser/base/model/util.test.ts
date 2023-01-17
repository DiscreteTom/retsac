import { Grammar, GrammarRule, GrammarType } from "../../../../src";
import {
  ruleStartsWith,
  ruleEndsWith,
} from "../../../../src/parser/base/model/util";

test("ruleStartsWith", () => {
  const rule1 = [
    new Grammar({ type: GrammarType.T, content: "number" }),
    new Grammar({ type: GrammarType.LITERAL, content: "+" }),
    new Grammar({ type: GrammarType.T, content: "number" }),
  ];
  const rule2 = [
    new Grammar({ type: GrammarType.T, content: "number" }),
    new Grammar({ type: GrammarType.LITERAL, content: "+" }),
  ];
  const rule3 = [new Grammar({ type: GrammarType.T, content: "number" })];

  expect(ruleStartsWith(rule1, rule1)).toBe(true);
  expect(ruleStartsWith(rule1, rule2)).toBe(true);
  expect(ruleStartsWith(rule1, rule3)).toBe(true);
  expect(ruleStartsWith(rule2, rule1)).toBe(false);
  expect(ruleStartsWith(rule2, rule2)).toBe(true);
  expect(ruleStartsWith(rule2, rule3)).toBe(true);
  expect(ruleStartsWith(rule3, rule1)).toBe(false);
  expect(ruleStartsWith(rule3, rule2)).toBe(false);
  expect(ruleStartsWith(rule3, rule3)).toBe(true);
});

test("ruleEndsWith", () => {
  const rule1 = [
    new Grammar({ type: GrammarType.T, content: "number" }),
    new Grammar({ type: GrammarType.LITERAL, content: "+" }),
    new Grammar({ type: GrammarType.T, content: "number" }),
  ];
  const rule2 = [
    new Grammar({ type: GrammarType.LITERAL, content: "+" }),
    new Grammar({ type: GrammarType.T, content: "number" }),
  ];
  const rule3 = [new Grammar({ type: GrammarType.T, content: "number" })];
  const rule4 = [
    new Grammar({ type: GrammarType.T, content: "number" }),
    new Grammar({ type: GrammarType.LITERAL, content: "-" }),
    new Grammar({ type: GrammarType.T, content: "number" }),
  ];

  expect(ruleEndsWith(rule1, rule1)).toBe(true);
  expect(ruleEndsWith(rule1, rule2)).toBe(true);
  expect(ruleEndsWith(rule1, rule3)).toBe(true);
  expect(ruleEndsWith(rule2, rule1)).toBe(false);
  expect(ruleEndsWith(rule2, rule2)).toBe(true);
  expect(ruleEndsWith(rule2, rule3)).toBe(true);
  expect(ruleEndsWith(rule3, rule1)).toBe(false);
  expect(ruleEndsWith(rule3, rule2)).toBe(false);
  expect(ruleEndsWith(rule3, rule3)).toBe(true);
  expect(ruleEndsWith(rule1, rule4)).toBe(false);
});
