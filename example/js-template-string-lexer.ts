import { Lexer } from "../src";

let tempStrDepth = 0;

let lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    tempStr: Lexer.from_to(
      "`",
      /(^`|[^\\]`)/, // '`' without escape
      false
    ).reject((s) => s.search(/[^\\]\$\{/) != -1), // reject if find '${`
    tempStrLeft: Lexer.from_to(
      "`",
      /(^\$\{|[^\\]\$\{)/, // '${' without escape
      false
    ).then((_) => tempStrDepth++), // use closure to store state
    tempStrRight: Lexer.from_to(
      "}",
      /(^`|[^\\]`)/, // '`' without escape
      false
    )
      .reject((s) => tempStrDepth == 0 || s.search(/[^\\]\$\{/) != -1)
      .then((_) => tempStrDepth--),
    tempStrMiddle: Lexer.from_to(
      "}",
      /(^\$\{|[^\\]\$\{)/, // '${' without escape
      false
    ).reject((_) => tempStrDepth == 0), // check state
    word: /^\w+/,
    string: Lexer.stringLiteral({ single: true }),
  })
  .anonymous(Lexer.exact(..."+"))
  .build();

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
