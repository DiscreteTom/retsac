import { lexer, builder, cache } from "./advanced-builder";

function stringify(obj: unknown) {
  return JSON.stringify(obj, null, 2);
}

test("serialize", () => {
  const { serializable } = builder.build({ lexer, serialize: true });
  expect(stringify(serializable)).toBe(stringify(cache));
});
