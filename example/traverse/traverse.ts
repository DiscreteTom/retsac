import { Lexer, ELR } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces())
  .define({
    number: /[0-9]+(?:\.[0-9]+)?/,
    identifier: /[a-zA-Z_][a-zA-Z0-9_]*/,
  })
  .define(Lexer.wordKind("function", "return"))
  .anonymous(Lexer.exact(..."=+;(){}"))
  .build();

/** name => value */
export const varMap = new Map<string, number>();

export const parser = new ELR.ParserBuilder<number>()
  .entry("stmts")
  // if a node has only one child, the default traverser will return the child's data.
  // if the child's data is undefined, the child's traverser will be called to get the data.
  .define({ stmts: `stmt` })
  // if a node has many children, the default traverser will traverse all children and return undefined.
  .define({ stmts: `stmts stmt` })
  .define(
    { stmt: `identifier '=' exp ';'` },
    ELR.traverser(({ $ }) => {
      // store the value of the expression to the variable
      // remember to use `child.traverse()` instead of `child.data` to get the data
      varMap.set($(`identifier`)[0].text!, $(`exp`)[0].traverse()!);
    })
  )
  .define(
    { exp: `exp '+' exp` },
    ELR.traverser(
      // remember to use `child.traverse()` instead of `child.data` to get the data
      ({ children }) => children![0].traverse()! + children![2].traverse()!
    )
  )
  .define(
    { exp: `number` },
    ELR.traverser(({ children }) => Number(children![0].text!))
    // reducer can still be used to set the data before traversing
    // ELR.reducer(({ matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `identifier` },
    // get the value of the variable from the map
    ELR.traverser(({ children }) => varMap.get(children![0].text!)!)
  )
  .resolveRS(
    { exp: `exp '+' exp` },
    { exp: `exp '+' exp` },
    { next: `'+'`, reduce: true }
  )
  .build(lexer, { checkAll: true });

export const parser2 = new ELR.ParserBuilder<number>()
  .entry("fn_def_stmt")
  .define(
    {
      fn_def_stmt: `
        function identifier '(' identifier ')' '{'
          stmt ';'
        '}'
      `,
    },
    ELR.traverser(({ $ }) => {
      // store the function name to the var map, with a random value to test
      varMap.set($(`identifier`)[0].text!, 123);
      // store the parameter name to the var map, with a random value to test
      varMap.set($(`identifier`)[1].text!, 456);
      // traverse the function body
      $(`stmt`)[0].traverse();
    })
  )
  .define(
    { stmt: `return exp` },
    // return expression value
    ELR.traverser(({ children }) => children![1].traverse())
  )
  .define(
    { exp: `identifier` },
    // get the value of the variable from the map
    ELR.traverser(({ children }) => varMap.get(children![0].text!)!)
  )
  .build(lexer, { checkAll: true });
