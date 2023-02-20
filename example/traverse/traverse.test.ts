import { parser, parser2, varMap } from "./traverse";

test("simple traverse", () => {
  const input = `
    a = 1;
    b = 2;
    c = a + b;
  `;

  const res = parser.reset().parseAll(input);
  expect(res.accept).toBe(true);
  if (!res.accept) return;

  res.buffer[0].traverse();

  expect(varMap.get("a")).toBe(1);
  expect(varMap.get("b")).toBe(2);
  expect(varMap.get("c")).toBe(3);
});

test("function traverse", () => {
  const input = `
    function hello(a) {
      return a;
    }
  `;

  const res = parser2.reset().parseAll(input);
  expect(res.accept).toBe(true);
  if (!res.accept) return;

  res.buffer[0].traverse();

  expect(res.buffer[0].children![6].data!).toBe(456);
});
