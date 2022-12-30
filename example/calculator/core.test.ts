import { manager } from "./core";

function getResult(input: string) {
  const res = manager.reset().parseAll(input);
  if (!res.accept || res.buffer.length != 1)
    throw new Error(
      `Reduce failed for input "${input}". Result: ${res.buffer}`
    );
  return res.buffer[0].data;
}

test("basic", () => {
  expect(getResult("1+1")).toBe(2);
});

test("negative number", () => {
  expect(getResult("-1-2")).toBe(-3);
  expect(getResult("1 - -1")).toBe(2);
  expect(getResult("2--2--2")).toBe(6);
  expect(getResult("2+-2+-2")).toBe(-2);
});

test("priority", () => {
  expect(getResult("2+3*4/5")).toBe(4.4);
  expect(getResult("(2+3)*4/5")).toBe(4);
  expect(getResult("2+3*(4--5)")).toBe(29);
});
