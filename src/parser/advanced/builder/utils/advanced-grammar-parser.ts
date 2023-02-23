import { ELR, Lexer } from "../../../..";
import { exact, stringLiteral } from "../../../../lexer";
import { applyResolvers } from "./resolvers";

const lexer = new Lexer.Builder()
  .ignore(
    /^\s/ // blank
  )
  .define({
    grammar: /^\w+/,
    literal: stringLiteral({ single: true, double: true }),
  })
  .anonymous(exact(...`|+*()?`))
  .build();

const parserBuilder = new ELR.ParserBuilder<string[]>()
  .entry("gr") // grammar rule
  .define(
    { gr: `grammar | literal` },
    // return the matched token text as a list
    ELR.traverser(({ children }) => [children![0].text!])
  )
  .define(
    { gr: `'(' gr ')'` },
    ELR.traverser(({ children }) => [...children![1].traverse()!])
  )
  .define(
    { gr: `gr '?'` },
    // append the possibility with empty string
    ELR.traverser(({ children }) => [...children![0].traverse()!, ""])
  )
  .define(
    { gr: `gr '*'` },
    // expand to '' and `gr+`
    ELR.traverser(({ children }) => [
      "",
      ...children![0].traverse()!.map((s) => `(${s})+`),
    ])
  )
  .define(
    { gr: `gr '+'` },
    // keep the `gr+`, we will process it later.
    ELR.traverser(({ children }) =>
      children![0].traverse()!.map((s) => `(${s})+`)
    )
  )
  .define(
    { gr: `gr '|' gr` },
    // merge the two possibility lists
    ELR.traverser(({ children }) => [
      ...children![0].traverse()!,
      ...children![2].traverse()!,
    ])
  )
  .define(
    { gr: `gr gr` },
    // get cartesian product of the two possibility lists
    ELR.traverser(({ children }) => {
      const result: string[] = [];
      const grs1 = children![0].traverse()!;
      const grs2 = children![1].traverse()!;
      grs1.forEach((gr1) => {
        grs2.forEach((gr2) => {
          // separate the two grammar rules with a space
          result.push(`${gr1} ${gr2}`);
        });
      });
      return result;
    })
  );
// .generateResolvers(grammarLexer)
// .checkAll(grammarLexer.getTokenTypes(), grammarLexer)

applyResolvers(parserBuilder);

/** This parser will expand grammar rules, except `gr+`. */
export const parser = parserBuilder.build(lexer);
