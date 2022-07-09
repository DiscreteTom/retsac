import { Lexer, LR, Manager } from "../src";

let lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    string: Lexer.stringLiteral({ double: true }),
    number: /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordType("true", "false", "null"))
  .anonymous(Lexer.exact(..."[]{},:"))
  .build();

let parser = new LR.ParserBuilder()
  .entry("value")
  .define(
    { value: "string" },
    LR.valueReducer((_, { matched }) => eval(matched[0].text)) // use `eval` to make `\\n` become `\n`
  )
  .define(
    { value: "number" },
    LR.valueReducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { value: "true" },
    LR.valueReducer(() => true)
  )
  .define(
    { value: "false" },
    LR.valueReducer(() => false)
  )
  .define(
    { value: "null" },
    LR.valueReducer(() => null)
  )
  .define(
    { value: "object | array" },
    LR.valueReducer((values) => values[0])
  )
  .define(
    { array: `'[' ']'` },
    LR.valueReducer(() => [])
  )
  .define(
    { array: `'[' values ']'` },
    LR.valueReducer((values) => values[1])
  )
  .define(
    { values: `value` },
    LR.valueReducer((values) => values) // values => [values[0]]
  )
  .define(
    { values: `values ',' value` },
    LR.valueReducer((values) => values[0].concat([values[2]]))
  )
  .define(
    { object: `'{' '}'` },
    LR.valueReducer(() => ({}))
  )
  .define(
    { object: `'{' object_items '}'` },
    LR.valueReducer((values) => values[1])
  )
  .define(
    { object_items: `object_item` },
    LR.valueReducer((values) => values[0])
  )
  .define(
    { object_items: `object_items ',' object_item` },
    LR.valueReducer((values) => Object.assign(values[0], values[2]))
  )
  .define(
    { object_item: `string ':' value` },
    LR.valueReducer((values, { matched }) => {
      let result = {};
      result[matched[0].text.slice(1, -1)] = values[2];
      return result;
    })
  )
  .checkSymbols(lexer.getTokenTypes())
  .build();

export let manager = new Manager({ lexer, parser });
