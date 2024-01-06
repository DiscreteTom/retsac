import { Builder, whitespaces, stringLiteral, exact } from "../../../../lexer";
import { ParserBuilder } from "../../builder";
import { applyResolvers } from "./resolvers";

type Placeholder = string;
type GrammarSnippet = string[];

export class PlaceholderMap {
  readonly p2g = new Map<Placeholder, GrammarSnippet>();
  readonly g2p = new Map<string, Placeholder>();
  readonly placeholderPrefix: string;

  constructor(options: { placeholderPrefix: string }) {
    this.placeholderPrefix = options.placeholderPrefix;
  }

  /**
   * Try to add a grammar snippet and return a placeholder.
   * If the grammar snippet is already in the map, return the placeholder.
   */
  add(gs: GrammarSnippet): Placeholder {
    const key = gs.join(" | ");
    let placeholder = this.g2p.get(key);
    if (placeholder === undefined) {
      // TODO: optimize placeholder name for better readability
      placeholder = this.placeholderPrefix + this.g2p.size;
      this.g2p.set(key, placeholder);
      this.p2g.set(placeholder, gs);
    }
    return placeholder;
  }

  reset() {
    this.p2g.clear();
    this.g2p.clear();
  }
}

export function grammarParserFactory(placeholderPrefix: string) {
  const lexer = new Builder()
    .ignore(whitespaces())
    .define({
      rename: /@\w+/,
      grammar: /\w+/,
      literal: [stringLiteral(`"`), stringLiteral(`'`)],
    })
    .anonymous(exact(...`|+*()?`))
    .build();

  const placeholderMap = new PlaceholderMap({
    placeholderPrefix,
  });

  // the data `string[]` represent all the expanded possibilities of the grammar rule
  const parserBuilder = new ParserBuilder()
    .data<string[]>()
    .lexer(lexer)
    .define(
      { gr: `grammar | literal` },
      // return the matched token text as a list
      (d) => d.traverser(({ children }) => [children[0].asT().text!]),
    )
    .define(
      { gr: `grammar rename | literal rename` },
      // just keep the format, but return as a list
      (d) =>
        d.traverser(({ children }) => [
          children[0].asT().text! + children[1].asT().text!,
        ]),
    )
    .define({ gr: `'(' gr ')'` }, (d) =>
      d.traverser(({ children }) => [...children[1].traverse()!]),
    )
    .define(
      { gr: `gr '?'` },
      // append the possibility with empty string
      (d) => d.traverser(({ children }) => [...children[0].traverse()!, ""]),
    )
    .define(
      { gr: `gr '*'` },
      // expand to `gr+` and '', and use a placeholder to represent `gr+`
      (d) =>
        d.traverser(({ children }) => [
          placeholderMap.add(
            children[0].traverse()!.filter((s) => s.length !== 0),
          ),
          "",
        ]),
    )
    .define(
      { gr: `gr '+'` },
      // keep the `gr+`, we use a placeholder to represent it
      (d) =>
        d.traverser(({ children }) => [
          placeholderMap.add(
            children[0].traverse()!.filter((s) => s.length !== 0),
          ),
        ]),
    )
    .define(
      { gr: `gr '|' gr` },
      // merge the two possibility lists, deduplicate
      (d) =>
        d.traverser(({ children }) => [
          ...new Set([...children[0].traverse()!, ...children[2].traverse()!]),
        ]),
    )
    .define(
      { gr: `gr gr` },
      // get cartesian product of the two possibility lists
      (d) =>
        d.traverser(({ children }) => {
          const result = new Set<string>(); // use set to deduplicate
          const grs1 = children[0].traverse()!;
          const grs2 = children[1].traverse()!;
          grs1.forEach((gr1) => {
            grs2.forEach((gr2) => {
              // separate the two grammar rules with a space
              // trim the result in case one of the grammar rule is empty
              result.add(`${gr1} ${gr2}`.trim());
            });
          });
          return [...result];
        }),
    )
    .use(applyResolvers);
  return { parserBuilder, placeholderMap };
}

export const entry = "gr" as const;

export type GrammarParserBuilder = ReturnType<
  typeof grammarParserFactory
>["parserBuilder"];
