import { Lexer } from "../src";

let lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    simpleStr: Lexer.stringLiteral({
      single: true,
      double: true,
    }),
    multilineStr: Lexer.stringLiteral({ back: true, multiline: true }),
    customQuote: Lexer.stringLiteral({ quote: "*" }),
    custom: Lexer.stringLiteral({ from: "^", to: "$" }),
  })
  .build();

function assertEq(input: string) {
  let token = lexer.reset().lex(input);
  if (token == null) throw new Error(`Can't tokenize ${input}`);
  if (token.content != input)
    throw new Error(
      `Mismatch, input=${input}, want=${input}, got=${token.content}`
    );
  console.log(token.content);
}

assertEq(`'123'`);
assertEq(`'123\\'456'`);
assertEq(`'123\\\\'`);
assertEq(`"123"`);
assertEq(`"123\\"456"`);
assertEq(`"123\\\\"`);
assertEq("`123`");
assertEq("`123\n456`");
assertEq("`123\\`456`");
assertEq("`123\\\\`");
assertEq(`*123*`);
assertEq(`*123\\*456*`);
assertEq(`*123\\\\*`);
assertEq(`^123$`);
assertEq(`^123\\$456$`);
assertEq(`^123\\\\$`);

console.log(`All check passed.`);
