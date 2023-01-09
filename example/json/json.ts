import { Lexer, LR, Manager } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    string: Lexer.stringLiteral({ double: true }),
    number: /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordType("true", "false", "null"))
  .anonymous(Lexer.exact(..."[]{},:"))
  .build();

const parser = new LR.ParserBuilder<any>()
  .entry("value")
  .define(
    { value: "string | number | true | false | null" },
    // especially, for string use `eval` to make `\\n` become `\n`
    LR.reducer((_, { matched }) => eval(matched[0].text!))
  )
  .define(
    { value: "object | array" },
    LR.reducer((values) => values[0])
  )
  .define(
    { array: `'[' ']'` },
    LR.reducer(() => [])
  )
  .define(
    { array: `'[' values ']'` },
    LR.reducer((values) => values[1])
  )
  .define(
    { values: `value` },
    LR.reducer((values) => values) // values => [values[0]]
  )
  .define(
    { values: `values ',' value` },
    LR.reducer((values) => values[0].concat([values[2]]))
  )
  .define(
    { object: `'{' '}'` },
    LR.reducer(() => ({}))
  )
  .define(
    { object: `'{' object_items '}'` },
    LR.reducer((values) => values[1])
  )
  .define(
    { object_items: `object_item` },
    LR.reducer((values) => values[0])
  )
  .define(
    { object_items: `object_items ',' object_item` },
    // merge objects
    LR.reducer((values) => Object.assign(values[0], values[2]))
  )
  .define(
    { object_item: `string ':' value` },
    // reduce to an object
    LR.reducer((values, { matched }) => {
      const result: { [key: string]: any } = {};
      result[matched[0].text!.slice(1, -1)] = values[2];
      return result;
    })
  )
  // .generateResolver(lexer)
  .checkAll(lexer.getTokenTypes(), lexer)
  .build();

export const manager = new Manager({ lexer, parser });
