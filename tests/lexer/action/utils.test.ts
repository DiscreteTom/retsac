import {
  CaretNotAllowedError,
  checkRegexNotStartsWithCaret,
  makeRegexAutoGlobal,
  makeRegexAutoSticky,
} from "../../../src/lexer";

describe("auto sticky", () => {
  test("sticky is added", () => {
    expect(makeRegexAutoSticky(/a/).sticky).toBe(true);
  });

  test("only sticky is added", () => {
    expect(makeRegexAutoSticky(/a/).flags).toBe("y");
  });

  test("text is not modified", () => {
    const r = /a/;
    expect(makeRegexAutoSticky(r).source).toBe(r.source);
  });

  test("do nothing if y/g is set", () => {
    expect(makeRegexAutoSticky(/a/y).flags).toBe("y");
    expect(makeRegexAutoSticky(/a/g).flags).toBe("g");
    expect(makeRegexAutoSticky(/a/gy).flags).toBe("gy");
  });
});

describe("auto global", () => {
  test("global is added", () => {
    expect(makeRegexAutoGlobal(/a/).global).toBe(true);
  });

  test("only global is added", () => {
    expect(makeRegexAutoGlobal(/a/).flags).toBe("g");
  });

  test("text is not modified", () => {
    const r = /a/;
    expect(makeRegexAutoGlobal(r).source).toBe(r.source);
  });

  test("do nothing if y/g is set", () => {
    expect(makeRegexAutoGlobal(/a/y).flags).toBe("y");
    expect(makeRegexAutoGlobal(/a/g).flags).toBe("g");
    expect(makeRegexAutoGlobal(/a/gy).flags).toBe("gy");
  });
});

describe("check regex not starts with ^", () => {
  test("throw error", () => {
    expect(() => checkRegexNotStartsWithCaret(/^a/)).toThrow(
      CaretNotAllowedError,
    );
  });

  test("do nothing", () => {
    expect(() => checkRegexNotStartsWithCaret(/a/)).not.toThrow();
  });
});
