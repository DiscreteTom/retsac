import { Lexer, ELR } from "../../../src";

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

export const { parser } = new ELR.ParserBuilder({
  lexer: lexer.clone({ buffer: "" }),
})
  .data<number>()
  // if a node has only one child, the default traverser will return the child's data.
  // if the child's data is undefined, the child's traverser will be called to get the data.
  .define({ stmts: `stmt` })
  // if a node has many children, the default traverser will traverse all children and return undefined.
  .define({ stmts: `stmts stmt` })
  .define({ stmt: `identifier '=' exp ';'` }, (d) =>
    d.traverser(({ $ }) => {
      // store the value of the expression to the variable
      // remember to use `child.traverse()` instead of `child.data` to get the data
      varMap.set($(`identifier`)!.text!, $(`exp`)!.traverse()!);
    }),
  )
  .define({ exp: `exp '+' exp` }, (d) =>
    d.traverser(
      // remember to use `child.traverse()` instead of `child.data` to get the data
      ({ children }) => children[0].traverse()! + children[2].traverse()!,
    ),
  )
  .define(
    { exp: `number` },
    (d) => d.traverser(({ children }) => Number(children[0].text!)),
    // reducer can still be used to set the data before traversing
    // ELR.reducer(({ matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `identifier` },
    // get the value of the variable from the map
    (d) => d.traverser(({ children }) => varMap.get(children[0].text!)!),
  )
  .resolveRS(
    { exp: `exp '+' exp` },
    { exp: `exp '+' exp` },
    { next: [`'+'`], accept: true },
  )
  .build({ entry: "stmts", checkAll: true });

export const { parser: parser2 } = new ELR.ParserBuilder({ lexer })
  .data<number>()
  .define(
    {
      fn_def_stmt: `
        function identifier '(' identifier ')' '{'
          stmt ';'
        '}'
      `,
    },
    (d) =>
      d.traverser(({ $$, $ }) => {
        // store the function name to the var map, with a random value to test
        varMap.set($$(`identifier`)[0].text!, 123);
        // store the parameter name to the var map, with a random value to test
        varMap.set($$(`identifier`)[1].text!, 456);
        // traverse the function body
        $(`stmt`)!.traverse();
      }),
  )
  .define(
    { stmt: `return exp` },
    // return expression value
    (d) => d.traverser(({ children }) => children[1].traverse()),
  )
  .define(
    { exp: `identifier` },
    // get the value of the variable from the map
    (d) => d.traverser(({ children }) => varMap.get(children[0].text!)!),
  )
  .build({ entry: "fn_def_stmt", checkAll: true });
