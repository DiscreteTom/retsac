// import { Lexer, ELR } from "../../../src";

// const lexer = new Lexer.Builder()
//   .ignore(Lexer.whitespaces())
//   .define({
//     // define types with the same rule
//     // so the parser will not be able to distinguish them
//     a: /\w+/,
//     b: /\w+/,
//     c: /\w+/,
//   })
//   .build();

// export const config = {
//   commitA: true,
//   rejectA: true,
// };

// export const { parser } = new ELR.ParserBuilder()
//   .define(
//     { entry: "a" },
//     ELR.commit(() => config.commitA),
//     ELR.rejecter(() => config.rejectA),
//   )
//   .define({ entry: `b` }, ELR.commit())
//   .define({ entry: `c` })
//   .entry("entry")
//   .build(lexer.clone(), { checkAll: true });
