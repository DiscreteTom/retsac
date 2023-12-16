import { Lexer } from "../../../../src";

test("javascript evalString", () => {
  expect(Lexer.javascript.evalString(`"abc"`)).toBe(`abc`);
  expect(Lexer.javascript.evalString(`"abc\\0"`)).toBe(`abc\0`);
  expect(Lexer.javascript.evalString(`"abc\\'def"`)).toBe(`abc'def`);
  expect(Lexer.javascript.evalString(`"abc\\"def"`)).toBe(`abc"def`);
  expect(Lexer.javascript.evalString(`"abc\\ndef"`)).toBe(`abc\ndef`);
  expect(Lexer.javascript.evalString(`"abc\\\\def"`)).toBe(`abc\\def`);
  expect(Lexer.javascript.evalString(`"abc\\rdef"`)).toBe(`abc\rdef`);
  expect(Lexer.javascript.evalString(`"abc\\vdef"`)).toBe(`abc\vdef`);
  expect(Lexer.javascript.evalString(`"abc\\tdef"`)).toBe(`abc\tdef`);
  expect(Lexer.javascript.evalString(`"abc\\bdef"`)).toBe(`abc\bdef`);
  expect(Lexer.javascript.evalString(`"abc\\fdef"`)).toBe(`abc\fdef`);
  expect(Lexer.javascript.evalString(`"abc\\\ndef"`)).toBe(`abcdef`);
  expect(Lexer.javascript.evalString(`"abc\\\`def"`)).toBe(`abc\`def`);
  expect(Lexer.javascript.evalString(`"abc\\x41def"`)).toBe(`abc\x41def`);
  expect(Lexer.javascript.evalString(`"abc\\u1234def"`)).toBe(`abc\u1234def`);
  expect(Lexer.javascript.evalString(`"abc\\u{2F804}def"`)).toBe(
    `abc\u{2F804}def`,
  );

  // all in one
  expect(
    Lexer.javascript.evalString(
      `"\\0\\'\\"\\n\\\\\\r\\v\\t\\b\\f\\\n\\\`\\x41\\u1234\\u{2F804}"`,
    ),
  ).toBe(`\0'"\n\\\r\v\t\b\f\`\x41\u1234\u{2F804}`);
});

test("javascript evalStringContent", () => {
  expect(Lexer.javascript.evalStringContent(`abc`)).toBe(`abc`);
  expect(Lexer.javascript.evalStringContent(`abc\\0`)).toBe(`abc\0`);
  expect(Lexer.javascript.evalStringContent(`abc\\'def`)).toBe(`abc'def`);
  expect(Lexer.javascript.evalStringContent(`abc\\"def`)).toBe(`abc"def`);
  expect(Lexer.javascript.evalStringContent(`abc\\ndef`)).toBe(`abc\ndef`);
  expect(Lexer.javascript.evalStringContent(`abc\\\\def`)).toBe(`abc\\def`);
  expect(Lexer.javascript.evalStringContent(`abc\\rdef`)).toBe(`abc\rdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\vdef`)).toBe(`abc\vdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\tdef`)).toBe(`abc\tdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\bdef`)).toBe(`abc\bdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\fdef`)).toBe(`abc\fdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\\ndef`)).toBe(`abcdef`);
  expect(Lexer.javascript.evalStringContent(`abc\\\`def`)).toBe(`abc\`def`);
  expect(Lexer.javascript.evalStringContent(`abc\\x41def`)).toBe(`abc\x41def`);
  expect(Lexer.javascript.evalStringContent(`abc\\u1234def`)).toBe(
    `abc\u1234def`,
  );
  expect(Lexer.javascript.evalStringContent(`abc\\u{2F804}def`)).toBe(
    `abc\u{2F804}def`,
  );

  // all in one
  expect(
    Lexer.javascript.evalStringContent(
      `\\0\\'\\"\\n\\\\\\r\\v\\t\\b\\f\\\n\\\`\\x41\\u1234\\u{2F804}`,
    ),
  ).toBe(`\0'"\n\\\r\v\t\b\f\`\x41\u1234\u{2F804}`);
});
