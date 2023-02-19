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

export const parser = new ELR.ParserBuilder<any>()
  .entry("value")
  .define(
    { value: "string | number | true | false | null" },
    // especially, for string use `eval` to make `\\n` become `\n`
    ELR.reducer(({ matched }) => eval(matched[0].text!))
  )
  .define(
    { value: "object | array" },
    ELR.reducer(({ values }) => values[0])
  )
  .define(
    { array: `'[' ']'` },
    ELR.reducer(() => [])
  )
  .define(
    { array: `'[' values ']'` },
    ELR.reducer(({ values }) => values[1])
  )
  .define(
    { values: `value` },
    ELR.reducer(({ values }) => values) // values => [values[0]]
  )
  .define(
    { values: `values ',' value` },
    ELR.reducer(({ values }) => values[0].concat([values[2]]))
  )
  .define(
    { object: `'{' '}'` },
    ELR.reducer(() => ({}))
  )
  .define(
    { object: `'{' object_items '}'` },
    ELR.reducer(({ values }) => values[1])
  )
  .define(
    { object_items: `object_item` },
    ELR.reducer(({ values }) => values[0])
  )
  .define(
    { object_items: `object_items ',' object_item` },
    // merge objects
    ELR.reducer(({ values }) => Object.assign(values[0], values[2]))
  )
  .define(
    { object_item: `string ':' value` },
    // reduce to an object
    ELR.reducer(({ matched, values }) => {
      const result: { [key: string]: any } = {};
      result[matched[0].text!.slice(1, -1)] = values[2];
      return result;
    })
  )
  // .generateResolvers(lexer)
  .checkAll(lexer.getTokenTypes(), lexer)
  .build(lexer);
