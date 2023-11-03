import {
  grammarParserFactory,
  entry,
} from "../../../src/parser/ELR/advanced/utils/grammar-parser-factory";
import { data } from "../../../src/parser/ELR/advanced/utils/serialized-grammar-parser-data";

function assertExpandedEqual(
  str: string,
  possibilities: string[],
  p2g: { [placeholder: string]: string[] },
) {
  const { parserBuilder, placeholderMap } = grammarParserFactory("__");
  const { parser } = parserBuilder.build({ entry, hydrate: data });
  const res = parser.reset().parseAll(str);

  // ensure the parser accepts the input
  expect(res.accept).toBe(true);
  expect(parser.lexer.getRest()).toBe("");
  expect(parser.buffer.length).toBe(1);

  // console.log(parser.buffer[0].traverse()?.sort());
  // console.log(placeholderMap);

  // check expanded possibilities
  expect(parser.buffer[0].traverse()?.sort()).toEqual(possibilities.sort());

  // check generated placeholder map
  for (const key in p2g) {
    expect(placeholderMap.p2g.get(key)!.sort()).toEqual(p2g[key].sort());
  }
}

test("expand 'gr+'", () => {
  assertExpandedEqual("a+", ["__0"], { __0: ["a"] });
  assertExpandedEqual("a b+", ["a __0"], { __0: ["b"] });
  assertExpandedEqual("a | b+", ["a", "__0"], { __0: ["b"] });
  assertExpandedEqual("(a b)+", ["__0"], { __0: ["a b"] });
  assertExpandedEqual("(a|b)+", ["__0"], { __0: ["a", "b"] });
  assertExpandedEqual("a+ b+", ["__0 __1"], { __0: ["a"], __1: ["b"] });
  assertExpandedEqual("a+ | b+", ["__0", "__1"], { __0: ["a"], __1: ["b"] });
});

test("expand 'gr*'", () => {
  assertExpandedEqual("a*", ["", "__0"], { __0: ["a"] });
  assertExpandedEqual("a b*", ["a", "a __0"], { __0: ["b"] });
  assertExpandedEqual("a | b*", ["", "a", "__0"], { __0: ["b"] });
  assertExpandedEqual("(a b)*", ["", "__0"], { __0: ["a b"] });
  assertExpandedEqual("(a|b)*", ["", "__0"], { __0: ["a", "b"] });
  assertExpandedEqual("a* b*", ["", "__0", "__1", "__0 __1"], {
    __0: ["a"],
    __1: ["b"],
  });
  assertExpandedEqual("a* | b*", ["", "__0", "__1"], {
    __0: ["a"],
    __1: ["b"],
  });
});
