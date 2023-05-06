import { parser } from "./advanced-builder";

test("advanced parser & cascade query & rename nodes", () => {
  const res = parser.parseAll(`
    pub fn main(p1: i32, p2: i32): i32 {
      let a: i32 = 1;
      let b: i32 = 2;
      let c: i32 = a + b;
      return a + b + c;
    }
  `);

  // console.log(res);
  expect(res.accept).toBe(true);

  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(parser.lexer.trimStart().getRest()).toBe("");

    // cascade query nested nodes
    expect(res.buffer[0].$(`param`).length).toBe(2);
    expect(res.buffer[0].$(`stmt`).length).toBe(4);

    // rename nodes
    expect(res.buffer[0].$(`funcName`).length).toBe(1);
    expect(res.buffer[0].$(`retType`).length).toBe(1);
    expect(res.buffer[0].$(`identifier`).length).toBe(0);

    // console.log(res.buffer[0].toTreeString());
  }
});
