// import { parser, someState } from "./re-lex";

// test("re-lex", () => {
//   const res = parser.parseAll("2--1");
//   expect(res.accept).toBe(true);

//   if (res.accept) {
//     expect(res.buffer.length).toBe(1);
//     expect(res.buffer[0].data!).toBe(3);
//   }
// });

// test("rollback", () => {
//   parser.reset().feed("2--1");
//   parser.parse(); // first parse, `exp--1`
//   parser.parse(); // second parse, `exp1`
//   expect(someState).toBe(1);
//   parser.parseAll(); // parse all, re-lex, should rollback
//   expect(someState).toBe(0);
// });
// TODO
