import { readFileSync } from "fs";
import { Lexer, ELR } from "../../src";
import { SerializableParserData } from "../../src/parser/ELR";

const cache = (() => {
  try {
    return JSON.parse(
      readFileSync("./example/json/dfa.json", "utf8")
    ) as SerializableParserData;
  } catch {
    return undefined;
  }
})();

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    string: Lexer.stringLiteral(`"`), // double quote string literal
    number: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordKind("true", "false", "null")) // type's name is the literal value
  .anonymous(Lexer.exact(..."[]{},:")) // single char borders
  .build();

const builder = new ELR.AdvancedBuilder()
  .useLexerKinds(lexer)
  .define(
    { value: `string | number | true | false | null` },
    // for string use `eval` to process escaped characters like `\n`
    ELR.traverser(({ children }) => eval(children[0].text!))
  )
  .define(
    { value: `object | array` },
    ELR.traverser(({ children }) => children[0].traverse())
  )
  .define(
    { array: `'[' (value (',' value)*)? ']'` },
    // use `$$` to select all children with the given kind
    ELR.traverser(({ $$ }) => $$(`value`).map((v) => v.traverse()))
  )
  .define(
    { object: `'{' (object_item (',' object_item)*)? '}'` },
    ELR.traverser(({ $$ }) => {
      // every object_item's traverse result is an object, we need to merge them
      const result: { [key: string]: any } = {};
      $$(`object_item`).forEach((item) => {
        Object.assign(result, item.traverse());
      });
      return result;
    })
  )
  .define(
    { object_item: `string ':' value` },
    // return an object
    // use `$` to select the first child with the given kind
    ELR.traverser(({ $ }) => {
      const result: { [key: string]: any } = {};
      // remove the double quotes
      result[$(`string`)!.text!.slice(1, -1)] = $(`value`)!.traverse();
      return result;
    })
  )
  .entry("value");

export const parser = builder.build(lexer, {
  // use the cached data to speed up
  // this is recommended in production
  hydrate: cache,
  // serialize the data for future use in `hydrate`
  // this is should be done before production
  serialize: true,
  // this should be set to `true` in development
  checkAll: true,
});

// since the `serialize` option is set to `true`,
// we can get the serializable data from the builder
export const serializable = builder.serializable;
