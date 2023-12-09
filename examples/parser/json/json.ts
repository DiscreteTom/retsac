import { Lexer, ELR } from "../../../src";
import { loadCache } from "../utils/parser-data-gen-common";

export const { cacheStr, cache } = loadCache("./examples/parser/json/dfa.json");

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    string: Lexer.json.stringLiteral(), // double quote string literal
    number: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordKind("true", "false", "null")) // type's name is the literal value
  .anonymous(Lexer.exact(..."[]{},:")) // single char borders
  .build();

export const builder = new ELR.AdvancedBuilder()
  .lexer(lexer)
  .data<unknown>()
  .define(
    { value: `string | number | true | false | null` },
    // for string use `eval` to process escaped characters like `\n`
    (d) => d.traverser(({ children }) => eval(children[0].text!)),
  )
  .define({ value: `object | array` }, (d) =>
    d.traverser(({ children }) => children[0].traverse()),
  )
  .define(
    { array: `'[' (value (',' value)*)? ']'` },
    // use `$$` to select all children with the given kind
    (d) => d.traverser(({ $$ }) => $$(`value`).map((v) => v.traverse())),
  )
  .define({ object: `'{' (object_item (',' object_item)*)? '}'` }, (d) =>
    d.traverser(({ $$ }) => {
      // every object_item's traverse result is an object, we need to merge them
      const result: { [key: string]: unknown } = {};
      $$(`object_item`).forEach((item) => {
        Object.assign(result, item.traverse());
      });
      return result;
    }),
  )
  .define(
    // use `@` to rename a grammar
    { object_item: `string@key ':' value` },
    // return an object
    (d) =>
      // use `$` to select the first child with the given kind
      d.traverser(({ $ }) => {
        const result: { [key: string]: unknown } = {};
        // remove the double quotes in the key string
        result[$(`key`)!.text!.slice(1, -1)] = $(`value`)!.traverse();
        return result;
      }),
  );

export const entry = "value" as const;
