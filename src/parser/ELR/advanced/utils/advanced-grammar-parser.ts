import { Builder, stringLiteral, exact } from "../../../../lexer";
import {
  Definition,
  DefinitionContextBuilder,
  ParserBuilder,
  traverser,
} from "../../builder";
import { Parser } from "../../parser";
import { applyResolvers } from "./resolvers";

type Placeholder = string;
type GrammarSnippet = string;

class PlaceholderMap {
  readonly p2g = new Map<Placeholder, GrammarSnippet>();
  readonly g2p = new Map<GrammarSnippet, Placeholder>();
  readonly placeholderPrefix: string;

  constructor(options: { placeholderPrefix: string }) {
    this.placeholderPrefix = options.placeholderPrefix;
  }

  /**
   * Try to add a grammar snippet and return a placeholder.
   * If the grammar snippet is already in the map, return the placeholder.
   */
  add(gs: GrammarSnippet): Placeholder {
    let placeholder = this.g2p.get(gs);
    if (placeholder === undefined) {
      placeholder = this.placeholderPrefix + this.g2p.size;
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

export class GrammarExpander {
  private readonly placeholderMap: PlaceholderMap;
  /** This parser will expand grammar rules, and collect placeholders for `gr+`. */
  private readonly parser: Parser<string[]>;
  readonly placeholderPrefix: string;

  constructor(options?: { placeholderPrefix?: string }) {
    this.placeholderPrefix = options?.placeholderPrefix ?? `__`;

    const lexer = new Builder()
      .ignore(
        /^\s/ // blank
      )
      .define({
        grammar: [/^\w+@\w+/, /^\w+/],
        literal: stringLiteral({ single: true, double: true }),
      })
      .anonymous(exact(...`|+*()?`))
      .build();

    this.placeholderMap = new PlaceholderMap({
      placeholderPrefix: this.placeholderPrefix,
    });

    // the data `string[]` represent all the expanded possibilities of the grammar rule
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
          ...children![0]
            .traverse()!
            .map((s) => this.placeholderMap.add(s.trim())),
        ])
      )
      .define(
        { gr: `gr '+'` },
        // keep the `gr+`, we use a placeholder to represent it
        traverser(({ children }) =>
          children![0].traverse()!.map((s) => this.placeholderMap.add(s.trim()))
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

    applyResolvers(parserBuilder);

    // this.parser = parserBuilder.build(lexer, {
    //   generateResolvers: "builder",
    //   checkAll: true,
    // });
    this.parser = parserBuilder.build(lexer);
  }

  expand<T>(
    builder: ParserBuilder<T>,
    s: string,
    NT: string,
    ctxBuilder: DefinitionContextBuilder<T> | undefined,
    debug: boolean | undefined
  ) {
    const res = this.parser.reset().parseAll(s);

    if (!res.accept || !this.allParsed())
      throw new Error("Invalid grammar rule: " + s);

    const expanded = res.buffer[0].traverse()!;

    const resultDef: Definition = {};
    resultDef[NT] = expanded;
    if (debug) console.log(`Expanded: ${NT}: \`${expanded.join(" | ")}\``);
    builder.define(resultDef, ctxBuilder);

    // auto resolve R-S conflict
    expanded.forEach((reducerRule, i) => {
      expanded.forEach((anotherRule, j) => {
        if (i == j) return;
        if (!anotherRule.startsWith(reducerRule)) return;

        builder.resolveRS(
          { [NT]: reducerRule },
          { [NT]: anotherRule },
          // in most cases we want the `+*?` to be greedy
          { next: "*", reduce: false }
        );
      });
    });

    return this;
  }

  private allParsed() {
    return !this.parser.lexer.hasRest() && this.parser.getNodes().length == 1;
  }

  resetAll() {
    this.parser.reset();
    this.placeholderMap.reset();
  }

  generatePlaceholderGrammarRules<T>(
    builder: ParserBuilder<T>,
    debug: boolean | undefined
  ) {
    this.placeholderMap.p2g.forEach((gs, p) => {
      const gr = `${gs} | ${gs} ${p}`;

      builder
        .define({ [p]: gr })
        // the gr will introduce an RS conflict, so we need to resolve it
        .resolveRS(
          { [p]: `${gs}` },
          { [p]: `${gs} ${p}` },
          // in most cases we want the `+*?` to be greedy
          { next: "*", reduce: false }
        );

      if (debug) console.log(`Generated: ${p}: \`${gr}\``);
    });

    return this;
  }
}
