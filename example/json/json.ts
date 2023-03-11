import { Lexer, ELR } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    string: Lexer.stringLiteral({ double: true }),
    number: /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordType("true", "false", "null"))
  .anonymous(Lexer.exact(..."[]{},:"))
  .build();

export const parser = new ELR.AdvancedBuilder<any>()
  .entry("value")
  .define(
    { value: `string | number | true | false | null` },
    // especially, for string use `eval` to make `\\x` become `\x`
    ELR.traverser(({ children }) => eval(children![0].text!))
  )
  .define(
    { value: `object | array` },
    ELR.traverser(({ children }) => children![0].traverse())
  )
  .define(
    { array: `'[' (value (',' value)*)? ']'` },
    ELR.traverser(({ $ }) => $(`value`).map((v) => v.traverse()))
  )
  .define(
    { object: `'{' (object_item (',' object_item)*)? '}'` },
    ELR.traverser(({ $ }) => {
      // every object_item's traverse result is an object, we need to merge them
      const result: { [key: string]: any } = {};
      $(`object_item`).forEach((item) => {
        Object.assign(result, item.traverse());
      });
      return result;
    })
  )
  .define(
    { object_item: `string ':' value` },
    // return an object
    ELR.traverser(({ $ }) => {
      const result: { [key: string]: any } = {};
      result[$(`string`)[0].text!.slice(1, -1)] = $(`value`)[0].traverse();
      return result;
    })
  )
  .build(lexer, { checkAll: true });
