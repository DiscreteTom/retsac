import { TempGrammarType } from "../../../../../src/parser/LR/builder/temp-grammar";
import { defToTempGRs } from "../../../../../src/parser/LR/builder/utils/definition";

test("defToTempGRs", () => {
  // normal
  const grs = defToTempGRs({ exp: `number | exp '+' exp` });
  expect(grs.length).toBe(2);
  expect(grs[0].NT).toBe("exp");
  expect(grs[0].rule.length).toBe(1);
  expect(grs[0].rule[0].type).toBe(TempGrammarType.GRAMMAR);
  expect(grs[0].rule[0].content).toBe("number");
  expect(grs[1].NT).toBe("exp");
  expect(grs[1].rule.length).toBe(3);
  expect(grs[1].rule[0].type).toBe(TempGrammarType.GRAMMAR);
  expect(grs[1].rule[0].content).toBe("exp");
  expect(grs[1].rule[1].type).toBe(TempGrammarType.LITERAL);
  expect(grs[1].rule[1].content).toBe("+");
  expect(grs[1].rule[2].type).toBe(TempGrammarType.GRAMMAR);
  expect(grs[1].rule[2].content).toBe("exp");

  // tokenize failed
  expect(() => defToTempGRs({ exp: `num+ber` })).toThrow(`Unable to tokenize`);

  // empty rule
  expect(() => defToTempGRs({ exp: `` })).toThrow(`Empty rule`);
  expect(() => defToTempGRs({ exp: `|` })).toThrow(
    `No grammar or literal in rule`
  );

  // empty literal
  expect(() => defToTempGRs({ exp: `''` })).toThrow(
    `Literal value can't be empty in rule`
  );

  // array
  const grs2 = defToTempGRs({ exp: [`number`, `exp '+' exp`] });
  expect(grs2.length).toBe(2);
  expect(grs2[0].NT).toBe("exp");
  expect(grs2[0].rule.length).toBe(1);
  expect(grs2[0].rule[0].type).toBe(TempGrammarType.GRAMMAR);
  expect(grs2[0].rule[0].content).toBe("number");
  expect(grs2[1].NT).toBe("exp");
  expect(grs2[1].rule.length).toBe(3);
  expect(grs2[1].rule[0].type).toBe(TempGrammarType.GRAMMAR);
  expect(grs2[1].rule[0].content).toBe("exp");
  expect(grs2[1].rule[1].type).toBe(TempGrammarType.LITERAL);
  expect(grs2[1].rule[1].content).toBe("+");
  expect(grs2[1].rule[2].type).toBe(TempGrammarType.GRAMMAR);
  expect(grs2[1].rule[2].content).toBe("exp");

  // with context
  let value = 0;
  const grs3 = defToTempGRs(
    { exp: `number | exp '+' exp` },
    { callback: () => (value = 1), rejecter: () => value == 1, resolved: [] }
  );
  grs3[0].callback!({ after: [], before: [], matched: [] });
  expect(value).toBe(1);
  expect(grs3[0].rejecter!({ after: [], before: [], matched: [] })).toBe(true);
});
