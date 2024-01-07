import { ELR, Lexer } from "../../src";

describe("ensure NTNode.global is shared", () => {
  test("ParserBuilder", () => {
    const lexer = new Lexer.Builder().define({ a: /a/ }).build();

    const { parser } = new ELR.ParserBuilder({ lexer })
      .global({ n: 0 })
      .define({ b: "a" })
      .define({ entry: "b b b" })
      .build({ entry: "entry" });

    const res = parser.parseAll("aaa");
    expect(res.accept).toBe(true);

    if (res.accept) {
      expect(res.buffer[0].asNT().children.length).toBe(3);

      res.buffer[0].asNT().children[0].asNT().global.n = 1;
      expect(res.buffer[0].asNT().children[1].asNT().global.n).toBe(1);
    }
  });

  test("AdvancedBuilder", () => {
    const lexer = new Lexer.Builder().define({ a: /a/ }).build();

    const { parser } = new ELR.AdvancedBuilder({ lexer })
      .global({ n: 0 })
      .define({ b: "a" })
      .define({ entry: "b b b" })
      .build({ entry: "entry" });

    const res = parser.parseAll("aaa");
    expect(res.accept).toBe(true);

    if (res.accept) {
      expect(res.buffer[0].asNT().children.length).toBe(3);

      res.buffer[0].asNT().children[0].asNT().global.n = 1;
      expect(res.buffer[0].asNT().children[1].asNT().global.n).toBe(1);
    }
  });
});
