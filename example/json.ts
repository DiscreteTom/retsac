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

let parser = new LR.ParserBuilder<any>()
  .entry("value")
  .define(
    { value: "string" },
    LR.dataReducer((_, { matched }) => eval(matched[0].text)) // use `eval` to make `\\n` become `\n`
  )
  .define(
    { value: "number" },
    LR.dataReducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { value: "true" },
    LR.dataReducer(() => true)
  )
  .define(
    { value: "false" },
    LR.dataReducer(() => false)
  )
  .define(
    { value: "null" },
    LR.dataReducer(() => null)
  )
  .define(
    { value: "object | array" },
    LR.dataReducer((values) => values[0])
  )
  .define(
    { array: `'[' ']'` },
    LR.dataReducer(() => [])
  )
  .define(
    { array: `'[' values ']'` },
    LR.dataReducer((values) => values[1])
  )
  .define(
    { values: `value` },
    LR.dataReducer((values) => values) // values => [values[0]]
  )
  .define(
    { values: `values ',' value` },
    LR.dataReducer((values) => values[0].concat([values[2]]))
  )
  .define(
    { object: `'{' '}'` },
    LR.dataReducer(() => ({}))
  )
  .define(
    { object: `'{' object_items '}'` },
    LR.dataReducer((values) => values[1])
  )
  .define(
    { object_items: `object_item` },
    LR.dataReducer((values) => values[0])
  )
  .define(
    { object_items: `object_items ',' object_item` },
    LR.dataReducer((values) => Object.assign(values[0], values[2]))
  )
  .define(
    { object_item: `string ':' value` },
    LR.dataReducer((values, { matched }) => {
      let result = {};
      result[matched[0].text.slice(1, -1)] = values[2];
      return result;
    })
  )
  .checkSymbols(lexer.getTokenTypes())
  .build();

export let manager = new Manager({ lexer, parser });
