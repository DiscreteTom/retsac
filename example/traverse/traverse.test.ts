import { parser, varMap } from "./traverse";

test("traverse", () => {
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
