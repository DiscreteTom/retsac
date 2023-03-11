import { Builder, stringLiteral, exact } from "../../../../lexer";
import {
  Definition,
  ParserBuilder,
  RS_ResolverOptions,
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

  constructor(options: { placeholderPrefix: string }) {
    this.placeholderPrefix = options.placeholderPrefix;

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
      )
      .use(applyResolvers);

    this.parser = parserBuilder.build(lexer, {
      // for debug
      // debug: true,
      // checkAll: true,
      // generateResolvers: "builder",
    });
  }

  expand<T>(
    s: string,
    NT: string,
    debug: boolean | undefined,
    resolve: boolean
  ) {
    const result = {
      defs: [] as Definition[],
      rs: [] as {
        reducerRule: Definition;
        anotherRule: Definition;
        options: RS_ResolverOptions<T>;
      }[],
    };
    const res = this.parser.reset().parseAll(s);

    if (!res.accept || !this.allParsed())
      throw new Error("Invalid grammar rule: " + s);

    const expanded = res.buffer[0].traverse()!;

    const resultDef: Definition = {};
    resultDef[NT] = expanded;
    if (debug) console.log(`Expanded: ${NT}: \`${expanded.join(" | ")}\``);
    result.defs.push(resultDef);

    // auto resolve R-S conflict
    if (resolve)
      expanded.forEach((reducerRule, i) => {
        expanded.forEach((anotherRule, j) => {
          if (i == j) return;
          if (!anotherRule.startsWith(reducerRule)) return;

          result.rs.push({
            reducerRule: { [NT]: reducerRule },
            anotherRule: { [NT]: anotherRule },
            // in most cases we want the `+*?` to be greedy
            options: { next: "*", reduce: false },
          });
          if (debug)
            console.log(
              `Generated Resolver: { ${NT}: \`${reducerRule}\`} | { ${NT}: \`${anotherRule}\`}, { next: "*", reduce: false }`
            );
        });
      });

    return result;
  }

  private allParsed() {
    return !this.parser.lexer.hasRest() && this.parser.getNodes().length == 1;
  }

  resetAll() {
    this.parser.reset();
    this.placeholderMap.reset();
  }

  generatePlaceholderGrammarRules<T>(debug: boolean | undefined) {
    const result = {
      defs: [] as Definition[],
      rs: [] as {
        reducerRule: Definition;
        anotherRule: Definition;
        options: RS_ResolverOptions<T>;
      }[],
    };

    this.placeholderMap.p2g.forEach((gs, p) => {
      const gr = `${gs} | ${gs} ${p}`;

      result.defs.push({ [p]: gr });
      // the gr will introduce an RS conflict, so we need to resolve it
      result.rs.push({
        reducerRule: { [p]: `${gs}` },
        anotherRule: { [p]: `${gs} ${p}` },
        // in most cases we want the `+*?` to be greedy
        options: { next: "*", reduce: false },
      });

      if (debug) {
        console.log(`Generated: ${p}: \`${gr}\``);
        console.log(
          `Generated Resolver: { ${p}: \`${gs}\`} | { ${p}: \`${gs} ${p}\`}, { next: "*", reduce: false }`
        );
      }
    });

    return result;
  }
}
