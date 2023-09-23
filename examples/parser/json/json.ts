import { readFileSync } from "fs";
import { Lexer, ELR } from "../../../src";

export const cache = (() => {
  try {
    return JSON.parse(readFileSync("./examples/parser/json/dfa.json", "utf8"));
  } catch {
    return undefined;
  }
})();

export const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    string: Lexer.stringLiteral(`"`), // double quote string literal
    number: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordKind("true", "false", "null")) // type's name is the literal value
  .anonymous(Lexer.exact(..."[]{},:")) // single char borders
  .build();

export const builder = new ELR.AdvancedBuilder()
  .define(
    { value: `string | number | true | false | null` },
    // for string use `eval` to process escaped characters like `\n`
    ELR.traverser(({ children }) => eval(children[0].text!)),
  )
  .define(
    { value: `object | array` },
    ELR.traverser(({ children }) => children[0].traverse()),
  )
  .define(
    { array: `'[' (value (',' value)*)? ']'` },
    // use `$$` to select all children with the given kind
    ELR.traverser(({ $$ }) => $$(`value`).map((v) => v.traverse())),
  )
  .define(
    { object: `'{' (object_item (',' object_item)*)? '}'` },
    ELR.traverser(({ $$ }) => {
      // every object_item's traverse result is an object, we need to merge them
      const result: { [key: string]: unknown } = {};
      $$(`object_item`).forEach((item) => {
        Object.assign(result, item.traverse());
      });
      return result;
    }),
  )
  .define(
    { object_item: `string ':' value` },
    // return an object
    // use `$` to select the first child with the given kind
    ELR.traverser(({ $ }) => {
      const result: { [key: string]: unknown } = {};
      // remove the double quotes
      result[$(`string`)!.text!.slice(1, -1)] = $(`value`)!.traverse();
      return result;
    }),
  )
  .entry("value");

export const { parser } = builder.build({
  lexer,
  // use the cached data to speed up
  // this is recommended in production
  hydrate: cache,
  // this should be set to `true` in development
  checkAll: true,
});
