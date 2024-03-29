import { Lazy } from "../../src";

describe("lazy", () => {
  test("without initial value", () => {
    expect(new Lazy(() => "123").raw).toBe(undefined);
  });

  test("with initial value", () => {
    expect(new Lazy(() => "123", "123").raw).toBe("123");
  });

  test("get value", () => {
    expect(new Lazy(() => "123").value).toBe("123");
  });

  test("reset value", () => {
    const lazy = new Lazy(() => "123", "456");
    lazy.reset();
    expect(lazy.raw).toBe(undefined);
    expect(lazy.value).toBe("123");
  });
});
