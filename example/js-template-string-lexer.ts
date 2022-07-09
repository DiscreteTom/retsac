import { Lexer } from "../src";

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

let lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    tempStr: Lexer.stringLiteral({ back: true, multiline: true }).reject(
      (s) => findUnescaped(s, "${") // reject if find '${` without escape
    ),
    tempStrLeft: Lexer.stringLiteral({
      from: "`",
      to: "${",
      multiline: true,
    }).then((_) => tempStrDepth++), // use closure to store state
    tempStrRight: Lexer.stringLiteral({ from: "}", to: "`", multiline: true })
      .reject(
        (s) =>
          tempStrDepth == 0 || // not in template string
          findUnescaped(s, "${") // contains another '${'
      )
      .then((_) => tempStrDepth--),
    tempStrMiddle: Lexer.stringLiteral({
      from: "}",
      to: "${",
      multiline: true,
    }).reject((_) => tempStrDepth == 0), // check state
    exp: /^\w+/,
    simpleString: Lexer.stringLiteral({ single: true, double: true }),
  })
  .anonymous(Lexer.exact(..."+"))
  .build();

// try to parse those
[`123`, `123 ${lexer}  \${789} 0`, `123 ${"123" + `456 ${999}`} 789`];

[
  "`123`",
  "`123 ${ lexer }  \\${789} 0`",
  "`123 ${ '123' + `456 ${ 999 }` } 789`",
].map((s) => {
  let tokens = lexer.reset().lexAll(s);
  console.log(`>>> Scanning: ${s} <<<`);
  console.log(tokens.map((t) => ({ type: t.type, content: t.content })));
  if (lexer.hasRest()) console.log(`Undigested: ${lexer.getRest()}`);
});
