import { tryOrDefault, tryOrUndefined } from "../../src";

describe("tryOrDefault", () => {
  test("no error", () => {
    expect(tryOrDefault(() => 1, 2)).toBe(1);
  });

  test("error", () => {
    expect(
      tryOrDefault(() => {
        throw new Error();
      }, 2),
    ).toBe(2);
  });
});

describe("tryOrUndefined", () => {
  test("no error", () => {
    expect(tryOrUndefined(() => 1)).toBe(1);
  });

  test("error", () => {
    expect(
      tryOrUndefined(() => {
        throw new Error();
      }),
    ).toBe(undefined);
  });
});
