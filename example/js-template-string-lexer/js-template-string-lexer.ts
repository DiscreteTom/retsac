import { Lexer } from "../../src";

let tempStrDepth = 0;

function findUnescaped(s: string, target: string) {
  for (let i = 0; i < s.length - target.length + 1; ++i) {
    if (s[i] == "\\") {
      i++; // escape next
      continue;
    }
    if (s.slice(i, i + target.length) == target) return true;
  }
  return false;
}

export const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces)
  .define({
    tempStr: Lexer.stringLiteral("`", { multiline: true }).reject(
      ({ content }) => findUnescaped(content, "${") // reject if find '${` without escape
    ),
    tempStrLeft: Lexer.stringLiteral("`", {
      close: "${",
      multiline: true,
    }).then(() => tempStrDepth++), // use closure to store state
    tempStrRight: Lexer.stringLiteral("}", { close: "`", multiline: true })
      .reject(
        ({ content }) =>
          tempStrDepth == 0 || // not in template string
          findUnescaped(content, "${") // contains another '${'
      )
      .then(() => tempStrDepth--),
    tempStrMiddle: Lexer.stringLiteral("}", {
      close: "${",
      multiline: true,
    }).reject(() => tempStrDepth == 0), // check state
    exp: /\w+/,
    simpleString: Lexer.stringLiteral(`'`).or(Lexer.stringLiteral(`"`)),
  })
  .anonymous(Lexer.exact(..."+"))
  .build();
