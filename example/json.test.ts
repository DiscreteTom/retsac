import { manager } from "./json";

function getResult(input: string) {
  let res = manager.reset().parse(input);
  if (!res.accept) throw new Error();
  if (res.buffer.length != 1) throw new Error();
  return res.buffer[0].data.value;
}

test("literal value", () => {
  expect(getResult(`false`)).toBe(false);
  expect(getResult(`true`)).toBe(true);
  expect(getResult(`null`)).toBe(null);
  expect(getResult(`"123"`)).toBe("123");
  expect(getResult(`"123\\""`)).toBe('123"');
  expect(getResult(`123`)).toBe(123);
  expect(getResult(`-123.456`)).toBe(-123.456);
});

test("empty struct", () => {
  expect(getResult(`[]`)).toEqual([]);
  expect(getResult(`{}`)).toEqual({});
});

test("single item struct", () => {
  expect(getResult(`[123]`)).toEqual([123]);
  expect(getResult(`{"key": "value"}`)).toEqual({ key: "value" });
});

test("multi item struct", () => {
  expect(getResult(`[123, 456, "789"]`)).toEqual([123, 456, "789"]);
  expect(getResult(`{"key": "value", "k": "v"}`)).toEqual({
    key: "value",
    k: "v",
  });
});

test("nested struct", () => {
  expect(getResult(`[[123, 456], ["789"], {"key":["value"]}]`)).toEqual([
    [123, 456],
    ["789"],
    { key: ["value"] },
  ]);
});
