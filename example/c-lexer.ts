import { Lexer } from "../src/lexer/lexer";
import { from_to } from "../src/lexer/utils";

const code = `
#include <stdio.h>
int main() {
    int number;

    printf("Enter an integer: ");

    // reads and stores input
    scanf("%d", &number);

    // displays output
    printf("You entered: %d", number);
    
    return 0;
}
`;

Lexer.ignore(
  /^\s/, // blank
  from_to("//", "\n", true), // single line comments
  from_to("/*", "*/", true), // multi-line comments
  from_to("#", "\n", true) // macro
)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
    ident: /^\w+/,
    string: from_to('"', '"', false),
  })
  .literal("++", "--", "+=", "-=", "*=", "/=", "%=", "==", "!=", "&=", "|=")
  .literal(..."+-*/()%?:!<>{};&|,")
  .lexAll(code)
  .map((token) => console.log(token));
