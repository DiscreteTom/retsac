import { defaultActionStateCloner } from "../../../src/lexer";

describe("default action state cloner", () => {
  test("clone simple types", () => {
    expect(defaultActionStateCloner(1)).toBe(1);
    expect(defaultActionStateCloner("1")).toBe("1");
    expect(defaultActionStateCloner(true)).toBe(true);
    expect(defaultActionStateCloner(false)).toBe(false);
  });

  test("clone array and object", () => {
    const obj = { a: 1 };
    const arr = [1, 2, 3];
    expect(defaultActionStateCloner(obj)).toEqual(obj);
    expect(defaultActionStateCloner(arr)).toEqual(arr);
  });

  test("deep clone", () => {
    const obj = { a: { b: 1 } };
    const arr = [1, [2, 3]];
    expect(defaultActionStateCloner(obj)).toEqual(obj);
    expect(defaultActionStateCloner(arr)).toEqual(arr);
  });
});
