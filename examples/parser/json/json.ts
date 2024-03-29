import { Lexer, ELR } from "../../../src";
import { loadCache } from "../utils/parser-data-gen-common";

export const { cacheStr, cache } = loadCache("./examples/parser/json/dfa.json");

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    // built-in support for JSON
    string: Lexer.json.stringLiteral(),
    number: Lexer.json.numericLiteral(),
  })
  .define(Lexer.wordKind("true", "false", "null")) // token's kind name equals to the literal value
  .anonymous(Lexer.exact(..."[]{},:")) // single char borders without a kind name
  .build();

export const builder = new ELR.AdvancedBuilder({ lexer })
  .data<unknown>()
  .define(
    { value: `string | number | true | false | null` },
    // eval the only child's text to get the value
    (d) => d.traverser(({ children }) => eval(children[0].text!)),
  )
  .define(
    { value: `object | array` },
    // call the only child's traverse method to get the object/array value
    (d) => d.traverser(({ children }) => children[0].traverse()),
  )
  .define(
    // `?` for zero or one, `*` for zero or more, use `()` to group
    // quote literal values with `'` or `"`
    { array: `'[' (value (',' value)*)? ']'` },
    // use `$$` to select all children with the given name
    // traverse all values in the array and return the result as an array
    (d) => d.traverser(({ $$ }) => $$(`value`).map((v) => v.traverse())),
  )
  .define(
    // use `@` to rename a grammar
    { object_item: `string@key ':' value` },
    (d) =>
      // return an object
      // use `$` to select the first child with the given name
      d.traverser(({ $ }) => ({
        // eval the key's value, then traverse child to get the entry's value
        [eval($(`key`)!.text!)]: $(`value`)!.traverse(),
      })),
  )
  .define({ object: `'{' (object_item (',' object_item)*)? '}'` }, (d) =>
    d.traverser(({ $$ }) =>
      // every object_item's traverse result is an object, we need to merge them.
      Object.assign({}, ...$$(`object_item`).map((item) => item.traverse())),
    ),
  );

export const entry = "value" as const;
