import { parser } from "./re-lex";

test("re-lex", () => {
  const res = parser.parseAll("2--1");
  expect(res.accept).toBe(true);

  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(res.buffer[0].data!).toBe(3);
  }
});
