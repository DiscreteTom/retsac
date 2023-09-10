import { Lexer, ELR } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    string: Lexer.stringLiteral(`"`), // double quote string literal
    number: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  })
  .define(Lexer.wordKind("true", "false", "null")) // type's name is the literal value
  .anonymous(Lexer.exact(..."[]{},:")) // single char borders
  .build();

export const parser = new ELR.AdvancedBuilder()
  .useLexerKinds(lexer)
  .entry("value")
  .define(
    { value: `string | number | true | false | null` },
    // especially, for string use `eval` to make `\\x` become `\x`
    ELR.traverser(({ children }) => eval(children[0].text!))
  )
  .define(
    { value: `object | array` },
    ELR.traverser(({ children }) => children[0].traverse())
  )
  .define(
    { array: `'[' (value (',' value)*)? ']'` },
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
    ELR.traverser(({ $ }) => {
      const result: { [key: string]: any } = {};
      result[$(`string`)!.text!.slice(1, -1)] = $(`value`)!.traverse();
      return result;
    })
  )
  .build(lexer, { checkAll: true });
