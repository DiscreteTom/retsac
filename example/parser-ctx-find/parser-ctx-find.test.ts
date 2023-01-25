import { parser, fName, returnType } from "./parser-ctx-find";

test("parser-ctx-find", () => {
  parser.parse(`pub fn foo() : i32 { }`);

  expect(fName).toBe("foo");
  expect(returnType).toBe("i32");
});
