import { Builder, exact, stringLiteral } from "../../../../lexer";
import { ParserBuilder, traverser } from "../../../ELR";
import { applyResolvers } from "./resolvers";

const lexer = new Builder()
  .ignore(
    /^\s/ // blank
  )
  .define({
    grammar: /^\w+/,
    literal: stringLiteral({ single: true, double: true }),
  })
  .anonymous(exact(...`|+*()?`))
  .build();

type Placeholder = string;
type GrammarSnippet = string;
// TODO: don't use a global variable, use a class instead
let placeholderPrefix = `__`;
class PlaceholderMap {
  readonly p2g = new Map<Placeholder, GrammarSnippet>();
  readonly g2p = new Map<GrammarSnippet, Placeholder>();

  get(p: Placeholder): GrammarSnippet | undefined {
    return this.p2g.get(p);
  }

  /**
   * Try to add a grammar snippet and return a placeholder.
   * If the grammar snippet is already in the map, return the placeholder.
   */
  add(gs: GrammarSnippet): Placeholder {
    let placeholder = this.g2p.get(gs);
    if (placeholder === undefined) {
      placeholder = placeholderPrefix + this.g2p.size;
      this.g2p.set(gs, placeholder);
      this.p2g.set(placeholder, gs);
    }
    return placeholder;
  }

  reset() {
    this.p2g.clear();
    this.g2p.clear();
  }
}

const placeholderMap = new PlaceholderMap();

const parserBuilder = new ParserBuilder<string[]>()
  .entry("gr") // grammar rule
  .define(
    { gr: `grammar | literal` },
    // return the matched token text as a list
    traverser(({ children }) => [children![0].text!])
  )
  .define(
    { gr: `'(' gr ')'` },
    traverser(({ children }) => [...children![1].traverse()!])
  )
  .define(
    { gr: `gr '?'` },
    // append the possibility with empty string
    traverser(({ children }) => [...children![0].traverse()!, ""])
  )
  .define(
    { gr: `gr '*'` },
    // expand to '' and `gr+`, and use a placeholder to represent `gr+`
    traverser(({ children }) => [
      "",
      ...children![0].traverse()!.map((s) => placeholderMap.add(s.trim())),
    ])
  )
  .define(
    { gr: `gr '+'` },
    // keep the `gr+`, we use a placeholder to represent it
    traverser(({ children }) =>
      children![0].traverse()!.map((s) => placeholderMap.add(s.trim()))
    )
  )
  .define(
    { gr: `gr '|' gr` },
    // merge the two possibility lists
    traverser(({ children }) => [
      ...children![0].traverse()!,
      ...children![2].traverse()!,
    ])
  )
  .define(
    { gr: `gr gr` },
    // get cartesian product of the two possibility lists
    traverser(({ children }) => {
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

/** This parser will expand grammar rules, and collect placeholders for `gr+`. */
export const parser = parserBuilder.build(lexer);

export function resetAll() {
  parser.reset();
  placeholderMap.reset();
}

export function generatePlaceholderGrammarRules() {
  const result = new Map<string, string>();
  placeholderMap.p2g.forEach((gs, p) => {
    result.set(p, `${gs} | ${p} ${gs}`);
  });
  return result;
}

export function setPrefix(prefix: string) {
  placeholderPrefix = prefix;
}
