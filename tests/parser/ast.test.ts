import type { TNode } from "../../src/parser";
import { TheTNode } from "../../src/parser";
import { ELR, Lexer } from "../../src";

describe("TNode", () => {
  const node = TheTNode.from(
    {
      content: "123",
      kind: "num",
      start: 0,
      data: 1,
    },
    2,
    3,
  ) as TNode<
    "num",
    string,
    number,
    number,
    {
      content: "123";
      kind: "num";
      start: 0;
      data: 1;
    },
    number
  >;
  test("from token", () => {
    expect(node.name).toBe("num");
    expect(node.kind).toBe("num");
    expect(node.start).toBe(0);
    expect(node.text).toBe("123");
    expect(node.parent).toBe(undefined);
    expect(node.data).toBe(2);
    expect(node.error).toBe(undefined);
    expect(node.global).toBe(3);
  });

  test("is", () => expect(node.is("num")).toBe(true));
  test("not is", () => expect(node.is("exp" as "num")).toBe(false));
  test("isT", () => expect(node.asASTNode().isT()).toBe(true));
  test("isNT", () => expect(node.asASTNode().isNT()).toBe(false));
  test("asT", () => expect(node.asASTNode().asT().text).toBe("123"));
  test("asNT", () => expect(node.asASTNode().asNT().$).toBe(undefined));
  test("traverse", () => expect(node.traverse()).toBe(2));

  test("toTreeString", () => {
    expect(node.toTreeString()).toBe('num: "123"\n');
  });
  test("toJSON", () => {
    expect(node.toJSON()).toEqual({
      name: "num",
      kind: "num",
      start: 0,
      text: "123",
      children: [],
    });
  });
});

describe("NTNode", () => {
  // simplified calculator
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces()) // ignore blank characters
    .define({ number: /[0-9]+(?:\.[0-9]+)?/ })
    .anonymous(Lexer.exact(..."+-*/()")) // operators
    .build();

  const { parser } = new ELR.ParserBuilder({ lexer })
    .data<number>()
    .define({ exp: "number" }, (d) =>
      d.traverser(({ children }) => Number(children[0].text)),
    )
    .define({ exp: `exp '+' exp` }, (d) =>
      d.traverser(
        ({ children }) => children[0].traverse()! + children[2].traverse()!,
      ),
    )
    .priority([{ exp: `exp '+' exp` }])
    .build({ entry: "exp", checkAll: true });

  const res = parser.parseAll("1+1");
  if (!res.accept) throw new Error("failed to parse");

  const node = res.buffer[0];

  test("is", () => expect(node.is("exp")).toBe(true));
  test("not is", () => expect(node.is("number")).toBe(false));
  test("isT", () => expect(node.isT()).toBe(false));
  test("isNT", () => expect(node.isNT()).toBe(true));
  test("asT", () => expect(node.asT().text).toBe(undefined));
  test("asNT", () => expect(node.asNT().$).not.toBe(undefined));
  test("data before traverse", () => expect(node.data).toBe(undefined));
  test("traverse", () => expect(node.traverse()).toBe(2));
  test("data", () => expect(node.data).toBe(2));
  test("children", () => expect(node.asNT().children.length).toBe(3));
  test("$", () =>
    expect(node.children![0].as("exp").$("number")).not.toBe(undefined));
  test("$$", () => expect(node.children![0].$$!("number").length).toBe(1));

  test("toTreeString", () => {
    expect(node.toTreeString()).toBe(
      `exp:\n  exp:\n    number: "1"\n  <anonymous>: "+"\n  exp:\n    number: "1"\n`,
    );
  });
  test("toJSON", () => {
    expect(node.toJSON()).toEqual({
      name: "exp",
      kind: "exp",
      start: 0,
      text: "",
      children: [
        {
          name: "exp",
          kind: "exp",
          start: 0,
          text: "",
          children: [
            {
              name: "number",
              kind: "number",
              start: 0,
              text: "1",
              children: [],
            },
          ],
        },
        {
          name: "",
          kind: "",
          start: 1,
          text: "+",
          children: [],
        },
        {
          name: "exp",
          kind: "exp",
          start: 2,
          text: "",
          children: [
            {
              name: "number",
              kind: "number",
              start: 2,
              text: "1",
              children: [],
            },
          ],
        },
      ],
    });
  });
});
