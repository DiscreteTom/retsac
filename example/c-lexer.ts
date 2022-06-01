import { Lexer } from "../src/lexer/lexer";
import { exact, from_to, word } from "../src/lexer/utils";

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

new Lexer()
  .ignore(
    /^\s/, // blank
    from_to("//", "\n", true), // single line comments
    from_to("/*", "*/", true), // multi-line comments
    from_to("#", "\n", true) // macro
  )
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
    keyword: word("int", "return", "if", "else", "break"),
    identifier: /^\w+/,
    string: from_to('"', '"', false),
  })
  .anonymous(
    exact("++", "--", "+=", "-=", "*=", "/=", "%=", "==", "!=", "&=", "|="), // two-char operator
    exact(..."+-*/()%?:!<>{};&|,") // one-char operator
  )
  .lexAll(code)
  .map((token) => console.log(token));
