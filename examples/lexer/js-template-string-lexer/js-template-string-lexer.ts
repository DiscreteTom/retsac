import { Lexer } from "../../../src";

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
  .useState({ tempStrDepth: 0 })
  .ignore(Lexer.whitespaces())
  .define({ tempStr: Lexer.stringLiteral("`", { multiline: true }) }, (a) =>
    a.reject(
      ({ output }) => findUnescaped(output.content, "${"), // reject if find '${` without escape
    ),
  )
  .define(
    {
      tempStrLeft: Lexer.stringLiteral("`", {
        close: "${",
        multiline: true,
      }),
    },
    (a) => a.then(({ input }) => input.state.tempStrDepth++),
  )
  .define(
    {
      tempStrRight: Lexer.stringLiteral("}", { close: "`", multiline: true }),
    },
    (a) =>
      a
        .reject(
          ({ output, input }) =>
            input.state.tempStrDepth == 0 || // not in template string
            findUnescaped(output.content, "${"), // contains another '${'
        )
        .then(({ input }) => input.state.tempStrDepth--),
  )
  .define(
    {
      tempStrMiddle: Lexer.stringLiteral("}", {
        close: "${",
        multiline: true,
      }),
    },
    (a) => a.reject(({ input }) => input.state.tempStrDepth == 0), // reject if not in template string
  )
  .define({
    exp: /\w+/,
    simpleString: [Lexer.stringLiteral(`'`), Lexer.stringLiteral(`"`)],
  })
  .anonymous(Lexer.exact(..."+"))
  .build();
