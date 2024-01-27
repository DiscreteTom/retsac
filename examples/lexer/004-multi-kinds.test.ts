import { Lexer } from "../../src";

test("possible kinds", () => {
  // there is a field `possibleKinds` in `Action`
  // which will be set if you use `builder.define` and `action.bind`

  // when you create a new Action, the target kind is never
  // so we have to use `bind` to bind the action to a specific kind
  const action = Lexer.Action.from(/a/).bind("A");
  expect(action.possibleKinds.has("A")).toBe(true);
  expect(action.possibleKinds.has("B" as never)).toBe(false);

  // when we use expectational lex, the possible kinds will be checked
  // to accelerate the lexing process
});

test("multi kinds", () => {
  // an action can be bound to multiple kinds
  // and we must provide a selector to choose a kind from the possible kinds
  const action = Lexer.Action.from(/a/)
    .kinds("A", "B")
    .select((ctx) => (ctx.output.hasRest() ? "A" : "B"));
  expect(action.possibleKinds.has("A")).toBe(true);
  expect(action.possibleKinds.has("B")).toBe(true);
  expect(action.possibleKinds.has("C" as never)).toBe(false);

  // but be aware, the possible kinds will NOT be checked during the runtime
  // so we MUST make sure the selector will always return a valid kind!

  // to use an action with possible_kinds set, we can use `builder.append`
  const lexer = new Lexer.Builder()
    .append((a) =>
      a
        .from(/a/)
        .kinds("A", "B")
        .select((ctx) => (ctx.output.hasRest() ? "A" : "B")),
    )
    .build("aa");

  // the first lex should be accepted as A
  let res = lexer.lex();
  let token = res.token!;
  expect(token.kind).toBe("A");

  // the second lex should be accepted as B
  res = lexer.lex();
  token = res.token!;
  expect(token.kind).toBe("B");
});
