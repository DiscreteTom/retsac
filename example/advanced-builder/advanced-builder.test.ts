import { parser } from "./advanced-builder";

test("advanced", () => {
  const res = parser.parseAll(`
    pub fn main(p1: i32, p2: i32): i32 {
      let a: i32 = 1;
      let b: i32 = 2;
      let c: i32 = a + b;
      return a + b + c;
    }
  `);

  expect(res.accept).toBe(true);

  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(parser.lexer.getRest()).toBe("");

    // console.log(res.buffer[0].toTreeString());
  }
});
