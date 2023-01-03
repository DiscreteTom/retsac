import { ASTNode } from "../../../../src/parser";
import { DefinitionContextBuilder } from "../../../../src/parser/LR/builder/ctx-builder";
import { ConflictType } from "../../../../src/parser/LR/builder/model";
import {
  TempGrammar,
  TempGrammarType,
} from "../../../../src/parser/LR/builder/temp-grammar";
import { ParserContext } from "../../../../src/parser/LR/model";

test("DefinitionContextBuilder basics", () => {
  const ctx = new DefinitionContextBuilder({}).build();
  expect(ctx.callback).toBeDefined();
  expect(ctx.rejecter).toBeDefined();
  expect(ctx.resolved).toEqual([]);

  // default rejecter should not reject
  expect(ctx.rejecter({ after: [], before: [], matched: [] })).toBe(false);
});

test("DefinitionContextBuilder with callback", () => {
  let result = 0;
  const ctx1 = DefinitionContextBuilder.callback(
    (ctx) => (result = ctx.after.length + 1)
  ).build();

  ctx1.callback({ after: [], before: [], matched: [] });
  expect(result).toBe(1);

  const ctx2 = DefinitionContextBuilder.callback(
    (ctx) => (result = ctx.matched.length + 2)
  )
    .callback((ctx) => (result = ctx.before.length + 3))
    .build();

  ctx2.callback({ after: [], before: [], matched: [] });
  expect(result).toBe(3); // callback will be called in order
  expect(ctx2.rejecter).toBeDefined();
  expect(ctx2.resolved).toEqual([]);
  // default rejecter should not reject
  expect(ctx2.rejecter({ after: [], before: [], matched: [] })).toBe(false);
});

test("DefinitionContextBuilder with rejecter", () => {
  const ctx1 = DefinitionContextBuilder.rejecter((ctx) => true).build();
  expect(ctx1.rejecter({ after: [], before: [], matched: [] })).toBe(true);

  // reject if any rejecter rejects
  const ctx2 = DefinitionContextBuilder.rejecter((ctx) => ctx.after.length == 0)
    .rejecter((ctx) => ctx.before.length != 0)
    .build();
  const ctx3 = DefinitionContextBuilder.rejecter(
    (ctx) => ctx.matched.length != 0
  )
    .rejecter((ctx) => ctx.after.length == 0)
    .build();
  const ctx4 = DefinitionContextBuilder.rejecter((ctx) => false)
    .rejecter((ctx) => false)
    .build();
  expect(ctx2.rejecter({ after: [], before: [], matched: [] })).toBe(true);
  expect(ctx3.rejecter({ after: [], before: [], matched: [] })).toBe(true);
  expect(ctx4.rejecter({ after: [], before: [], matched: [] })).toBe(false);
});

test("DefinitionContextBuilder with reducer", () => {
  const ctx1 = DefinitionContextBuilder.reducer<number>(
    (values) => values.length
  ).build();

  const reducerCtx: ParserContext<number> = {
    after: [],
    before: [],
    matched: [],
  };
  ctx1.callback(reducerCtx);
  expect(reducerCtx.data).toBe(0);

  const ctx2 = DefinitionContextBuilder.reducer<number>(
    (values) => values.length
  )
    .reducer((values) => values.length + 1)
    .build();

  ctx2.callback(reducerCtx);
  // reducer will be called in order
  expect(reducerCtx.data).toBe(1);
});

test("DefinitionContextBuilder with RS conflict resolver", () => {
  // reduce will be true by default
  const ctx1 = DefinitionContextBuilder.resolveRS(
    { exp: `number` },
    { next: `exp '+'` }
  ).build();

  // RS resolver won't reject end
  expect(ctx1.rejecter({ after: [], before: [], matched: [] })).toBe(false);
  // next match, reduce
  expect(
    ctx1.rejecter({
      after: [new ASTNode({ type: "exp", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(false);
  // next not match, don't reject
  expect(
    ctx1.rejecter({
      after: [new ASTNode({ type: "aaa", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(false);
  // check resolved
  expect(ctx1.resolved.length).toBe(1);
  expect(ctx1.resolved[0].handleEnd).toBe(false);
  expect(ctx1.resolved[0].type).toBe(ConflictType.REDUCE_SHIFT);
  expect(
    ctx1.resolved[0].next.every((tg) =>
      [
        new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "exp" }),
        new TempGrammar({ type: TempGrammarType.LITERAL, content: "+" }),
      ].some((tg2) => tg.eq(tg2))
    )
  ).toBe(true);
  expect(ctx1.resolved[0].anotherRule.NT).toBe("exp");
  expect(ctx1.resolved[0].anotherRule.rule.length).toBe(1);
  expect(ctx1.resolved[0].anotherRule.rule[0].content).toBe("number");
  expect(ctx1.resolved[0].anotherRule.rule[0].type).toBe(
    TempGrammarType.GRAMMAR
  );

  // reduce is false
  const ctx2 = DefinitionContextBuilder.resolveRS(
    { exp: `number` },
    { next: `exp '+'` }
  )
    .resolveRS({ exp: `number` }, { next: `exp '+'`, reduce: false })
    .build();
  // RS resolver won't reject end
  expect(ctx2.rejecter({ after: [], before: [], matched: [] })).toBe(false);
  // next match, reduce is false
  expect(
    ctx2.rejecter({
      after: [new ASTNode({ type: "exp", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(true);
  // next not match, don't reject
  expect(
    ctx2.rejecter({
      after: [new ASTNode({ type: "aaa", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(false);
  // check resolved
  expect(ctx2.resolved.length).toBe(2);

  // reduce is a function
  const ctx3 = DefinitionContextBuilder.resolveRS(
    { exp: `number` },
    { next: `exp '+'`, reduce: (ctx) => ctx.after.length == 0 }
  ).build();
  // RS resolver won't reject end
  expect(ctx3.rejecter({ after: [], before: [], matched: [] })).toBe(false);
  // next match, reduce is false
  expect(
    ctx3.rejecter({
      after: [new ASTNode({ type: "exp", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(true);
  // next not match, don't reject
  expect(
    ctx3.rejecter({
      after: [new ASTNode({ type: "aaa", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(false);
});

test("DefinitionContextBuilder with RR conflict resolver", () => {
  // reduce will be true by default, handleEnd will be false by default
  const ctx1 = DefinitionContextBuilder.resolveRR(
    { exp: `number` },
    { next: `exp '+'` }
  ).build();

  // resolver didn't handle end
  expect(ctx1.rejecter({ after: [], before: [], matched: [] })).toBe(false);
  // next match, reduce
  expect(
    ctx1.rejecter({
      after: [new ASTNode({ type: "exp", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(false);
  // next not match, don't reject
  expect(
    ctx1.rejecter({
      after: [new ASTNode({ type: "aaa", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(false);
  // check resolved
  expect(ctx1.resolved.length).toBe(1);
  expect(ctx1.resolved[0].handleEnd).toBe(false);
  expect(ctx1.resolved[0].type).toBe(ConflictType.REDUCE_REDUCE);
  expect(
    ctx1.resolved[0].next.every((tg) =>
      [
        new TempGrammar({ type: TempGrammarType.GRAMMAR, content: "exp" }),
        new TempGrammar({ type: TempGrammarType.LITERAL, content: "+" }),
      ].some((tg2) => tg.eq(tg2))
    )
  ).toBe(true);
  expect(ctx1.resolved[0].anotherRule.NT).toBe("exp");
  expect(ctx1.resolved[0].anotherRule.rule.length).toBe(1);
  expect(ctx1.resolved[0].anotherRule.rule[0].content).toBe("number");
  expect(ctx1.resolved[0].anotherRule.rule[0].type).toBe(
    TempGrammarType.GRAMMAR
  );

  // reduce is false
  const ctx2 = DefinitionContextBuilder.resolveRR(
    { exp: `number` },
    { next: `exp '+'` }
  )
    .resolveRR({ exp: `number` }, { next: `exp '+'`, reduce: false })
    .build();
  // resolver didn't handle end
  expect(ctx2.rejecter({ after: [], before: [], matched: [] })).toBe(false);
  // next match, reduce is false
  expect(
    ctx2.rejecter({
      after: [new ASTNode({ type: "exp", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(true);
  // next not match, don't reject
  expect(
    ctx2.rejecter({
      after: [new ASTNode({ type: "aaa", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(false);
  // check resolved
  expect(ctx2.resolved.length).toBe(2);

  // reduce is a function
  const ctx3 = DefinitionContextBuilder.resolveRR(
    { exp: `number` },
    { next: `exp '+'`, reduce: (ctx) => ctx.after.length == 0 }
  ).build();
  // RS resolver won't reject end
  expect(ctx3.rejecter({ after: [], before: [], matched: [] })).toBe(false);
  // next match, reduce is false
  expect(
    ctx3.rejecter({
      after: [new ASTNode({ type: "exp", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(true);
  // next not match, don't reject
  expect(
    ctx3.rejecter({
      after: [new ASTNode({ type: "aaa", start: 0 })],
      before: [],
      matched: [],
    })
  ).toBe(false);
});

test("DefinitionContextBuilder with RR conflict resolver, handle end", () => {
  // reduce will be true by default, handle end
  const ctx1 = DefinitionContextBuilder.resolveRR(
    { exp: `number` },
    { handleEnd: true }
  ).build();

  // resolver handle end
  expect(ctx1.rejecter({ after: [], before: [], matched: [] })).toBe(false);
  // next match, reduce

  // reduce is false, handle end
  const ctx2 = DefinitionContextBuilder.resolveRR(
    { exp: `number` },
    { next: `exp '+'`, reduce: false, handleEnd: true }
  ).build();
  // handle end, don't reduce, which means reject
  expect(ctx2.rejecter({ after: [], before: [], matched: [] })).toBe(true);

  // reduce is a function, handle end
  const ctx3 = DefinitionContextBuilder.resolveRR(
    { exp: `number` },
    {
      next: `exp '+'`,
      reduce: (ctx) => ctx.before.length == 0,
      handleEnd: true,
    }
  ).build();
  // RS resolver won't reject end
  expect(
    ctx3.rejecter({
      after: [],
      before: [new ASTNode({ type: "aaa", start: 0 })],
      matched: [],
    })
  ).toBe(true);
});

// additional test for full branch coverage
test("DefinitionContextBuilder with conflict resolver in other conditions", () => {
  const ctx1 = new DefinitionContextBuilder({})
    .resolveRR({ exp: `number` }, { handleEnd: true })
    .build();
  expect(ctx1.resolved[0].handleEnd).toBe(true);
  expect(ctx1.resolved[0].next.length).toBe(0);

  const ctx2 = new DefinitionContextBuilder({})
    .resolveRR({ exp: `number` }, { next: "exp" })
    .build();
  expect(ctx2.resolved[0].handleEnd).toBe(false);
  expect(ctx2.resolved[0].next.length).toBe(1);

  const ctx3 = new DefinitionContextBuilder({})
    .resolveRS({ exp: `number` }, { next: "exp" })
    .build();
  expect(
    ctx3.rejecter({
      after: [new ASTNode({ start: 0, type: "exp" })],
      before: [],
      matched: [],
    })
  ).toBe(false);
});
