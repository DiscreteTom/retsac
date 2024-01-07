import { ELR, Lexer } from "../../src";

describe("ensure TNode's data is generated", () => {
  test("ParserBuilder", () => {
    const { parser } = new ELR.ParserBuilder({
      lexer: new Lexer.Builder().define({ a: /a/ }).build(),
    })
      .data("")
      .mapper({
        a: (token) => token.content,
      })
      .define({ entry: "a a a" })
      .build({ entry: "entry" });

    const res = parser.parseAll("aaa");
    expect(res.accept).toBe(true);

    if (res.accept) {
      expect(res.buffer[0].asNT().children[0].asT().data).toBe("a");
    }
  });
  test("AdvancedBuilder", () => {
    const { parser } = new ELR.AdvancedBuilder({
      lexer: new Lexer.Builder().define({ a: /a/ }).build(),
    })
      .data("")
      .mapper({
        a: (token) => token.content,
      })
      .define({ entry: "a a a" })
      .build({ entry: "entry" });

    const res = parser.parseAll("aaa");
    expect(res.accept).toBe(true);

    if (res.accept) {
      expect(res.buffer[0].asNT().children[0].asT().data).toBe("a");
    }
  });
});
