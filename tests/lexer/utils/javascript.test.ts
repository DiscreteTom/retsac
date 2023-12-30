import { Lexer } from "../../../src";

// TODO: move into javascript folder
test("javascript comment", () => {
  const lexer = new Lexer.Builder()
    .define({
      comment: Lexer.javascript.comment(),
    })
    .build();

  // single line
  expect(lexer.reset().lex("// abc\n")?.content).toBe("// abc\n");
  expect(lexer.reset().lex("// abc\n// def")?.content).toBe("// abc\n");

  // multi line
  expect(lexer.reset().lex("/* abc */")?.content).toBe("/* abc */");
  expect(lexer.reset().lex("/* abc\n*/")?.content).toBe("/* abc\n*/");
  expect(lexer.reset().lex("/* abc\n*/\n")?.content).toBe("/* abc\n*/");

  // unclosed
  expect(lexer.reset().lex("// abc")?.content).toBe("// abc");
  expect(lexer.reset().lex("/* abc")?.content).toBe("/* abc");
});
