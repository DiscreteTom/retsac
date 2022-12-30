import { lexer } from "./js-template-string-lexer";

function getResult(input: string) {
  const tokens = lexer.reset().lexAll(input);
  if (lexer.hasRest()) throw new Error(`Undigested: ${lexer.getRest()}`);
  return tokens.map((t) => t.content);
}

test("basic", () => {
  expect(getResult("`123`")).toEqual(["`123`"]);
});

test("template and escape", () => {
  expect(getResult("`123 ${ lexer }  \\${789} 0`")).toEqual([
    "`123 ${",
    "lexer",
    "}  \\${789} 0`",
  ]);
});

test("nested template", () => {
  expect(getResult("`123 ${ '123' + `456 ${ 999 }` } 789`")).toEqual([
    "`123 ${",
    "'123'",
    "+",
    "`456 ${",
    "999",
    "}`",
    "} 789`",
  ]);
});
