import { Lexer } from "../src/lexer/lexer";
import { exact, from_to, stringLiteral } from "../src/lexer/utils";

let tempStrDepth = 0;

let lexer = new Lexer()
  .ignore(/^\s/)
  .define({
    tempStr: from_to(
      "`",
      /(^`|[^\\]`)/, // '`' without escape
      false
    ).reject((s) => s.search(/[^\\]\$\{/) != -1), // reject if find '${`
    tempStrLeft: from_to(
      "`",
      /(^\$\{|[^\\]\$\{)/, // '${' without escape
      false
    ).then((_) => tempStrDepth++), // use closure to store state
    tempStrRight: from_to(
      "}",
      /(^`|[^\\]`)/, // '`' without escape
      false
    )
      .reject((s) => tempStrDepth == 0 || s.search(/[^\\]\$\{/) != -1)
      .then((_) => tempStrDepth--),
    tempStrMiddle: from_to(
      "}",
      /(^\$\{|[^\\]\$\{)/, // '${' without escape
      false
    ).reject((_) => tempStrDepth == 0), // check state
    word: /^\w+/,
    string: stringLiteral({ single: true }),
  })
  .anonymous(exact(..."+"));

[
  "`123`", // `123`
  "`123 ${ lexer }  \\${789} 0`", // `123 ${ lexer }  \${789} 0`
  "`123 ${ '123' + `456 ${ 999 }` } 789`", // `123 ${ '123' + `456 ${ 999 }` } 789`
].map((s) => {
  lexer.reset();
  let tokens = lexer.lexAll(s);
  console.log(`>>> Scanning: ${s} <<<`);
  console.log(tokens.map((t) => ({ type: t.type, content: t.content })));
  if (lexer.hasRest()) console.log(`Undigested: ${lexer.getRest()}`);
});
