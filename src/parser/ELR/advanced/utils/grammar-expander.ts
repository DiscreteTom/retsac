import { Builder, stringLiteral, exact, whitespaces } from "../../../../lexer";
import type { Logger } from "../../../../logger";
import type { IParser } from "../../../model";
import type { Definition, RS_ResolverOptions } from "../../builder";
import { ParserBuilder, traverser } from "../../builder";
import { InvalidGrammarRuleError } from "../error";
import { applyResolvers } from "./resolvers";
import { data } from "./serialized-grammar-parser-data";

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
      // TODO: optimize placeholder name for better readability
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
  const parserBuilder = new ParserBuilder<string[]>()
    .define(
      { gr: `grammar | literal` },
      // return the matched token text as a list
      traverser(({ children }) => [children[0].text!]),
    )
    .define(
      { gr: `grammar rename | literal rename` },
      // just keep the format, but return as a list
      traverser(({ children }) => [children[0].text! + children[1].text!]),
    )
    .define(
      { gr: `'(' gr ')'` },
      traverser(({ children }) => [...children[1].traverse()!]),
    )
    .define(
      { gr: `gr '?'` },
      // append the possibility with empty string
      traverser(({ children }) => [...children[0].traverse()!, ""]),
    )
    .define(
      { gr: `gr '*'` },
      // expand to '' and `gr+`, and use a placeholder to represent `gr+`
      traverser(({ children }) => [
        "",
        ...children[0].traverse()!.map((s) => placeholderMap.add(s.trim())),
      ]),
    )
    .define(
      { gr: `gr '+'` },
      // keep the `gr+`, we use a placeholder to represent it
      traverser(({ children }) =>
        children[0].traverse()!.map((s) => placeholderMap.add(s.trim())),
      ),
    )
    .define(
      { gr: `gr '|' gr` },
      // merge the two possibility lists
      traverser(({ children }) => [
        ...children[0].traverse()!,
        ...children[2].traverse()!,
      ]),
    )
    .define(
      { gr: `gr gr` },
      // get cartesian product of the two possibility lists
      traverser(({ children }) => {
        const result: string[] = [];
        const grs1 = children[0].traverse()!;
        const grs2 = children[1].traverse()!;
        grs1.forEach((gr1) => {
          grs2.forEach((gr2) => {
            // separate the two grammar rules with a space
            result.push(`${gr1} ${gr2}`);
          });
        });
        return result;
      }),
    )
    .use(applyResolvers)
    .entry("gr");
  return { parserBuilder, lexer, placeholderMap };
}

export class GrammarExpander<Kinds extends string, LexerKinds extends string> {
  private readonly placeholderMap: PlaceholderMap;
  /** This parser will expand grammar rules, and collect placeholders for `gr+`. */
  private readonly parser: IParser<
    string[],
    unknown,
    "gr",
    "" | "grammar" | "literal" | "rename",
    string
  >;
  readonly placeholderPrefix: string;

  constructor(options: { placeholderPrefix: string }) {
    this.placeholderPrefix = options.placeholderPrefix;

    const { parserBuilder, lexer, placeholderMap } = grammarParserFactory(
      this.placeholderPrefix,
    );

    this.placeholderMap = placeholderMap;
    this.parser = parserBuilder.build(lexer, {
      hydrate: data,
      // for debug
      // debug: true,
      // checkAll: true,
      // generateResolvers: "builder",
    }).parser;
  }

  expand<ASTData, ErrorType>(
    s: string,
    NT: Kinds,
    debug: boolean,
    logger: Logger,
    /**
     * Whether to auto resolve R-S conflict.
     */
    resolve: boolean,
  ) {
    const result = {
      defs: [] as Definition<Kinds>[],
      rs: [] as {
        reducerRule: Definition<Kinds>;
        anotherRule: Definition<Kinds>;
        options: RS_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;
      }[],
    };
    const res = this.parser.reset().parseAll(s);

    if (!res.accept || !this.allParsed()) throw new InvalidGrammarRuleError(s);

    const expanded = res.buffer[0].traverse()!;

    const resultDef: Definition<Kinds> = {};
    resultDef[NT] = expanded;
    if (debug)
      logger(
        `[AdvancedBuilder.build] Expanded: ${NT}: \`${expanded.join(" | ")}\``,
      );
    result.defs.push(resultDef);

    // auto resolve R-S conflict for generated grammar rules
    // e.g.: { a: `b c?`, d: `a c` } will be expanded into
    // { a: `b | b c`, d: `a c` }
    // found RS conflict: reducer { a: `b` } and shifter { a: `b c` }
    // and `c` is in the follow set of `a` and the first set of `c`
    // so the conflict can't be auto resolved by LR(1) peeking
    // in the worst cases, { a: `b` } and { a: `b c` } will appear in the same state
    // in that case, this conflict can't be auto resolved by DFA state, either
    // so we need to add resolvers here
    if (resolve)
      expanded.forEach((reducerRule, i) => {
        expanded.forEach((anotherRule, j) => {
          if (i == j) return;
          if (!anotherRule.startsWith(reducerRule)) return;

          result.rs.push({
            reducerRule: { [NT]: reducerRule } as Definition<Kinds>,
            anotherRule: { [NT]: anotherRule } as Definition<Kinds>,
            // in most cases we want the `+*?` to be greedy
            options: { next: "*", accept: false },
          });
          if (debug)
            logger(
              `[AdvancedBuilder.build] Generated Resolver: { ${NT}: \`${reducerRule}\`} | { ${NT}: \`${anotherRule}\`}, { next: "*", accept: false }`,
            );
        });
      });

    return result;
  }

  private allParsed() {
    return (
      !this.parser.lexer.trimStart().hasRest() && this.parser.buffer.length == 1
    );
  }

  resetAll() {
    this.parser.reset();
    this.placeholderMap.reset();
  }

  // TODO: what if the generated grammars have conflicts with user defined grammars? is this possible?
  generatePlaceholderGrammarRules<ASTData, ErrorType>(
    debug: boolean,
    logger: Logger,
  ) {
    const result = {
      defs: [] as Definition<Kinds>[],
      rs: [] as {
        reducerRule: Definition<Kinds>;
        anotherRule: Definition<Kinds>;
        options: RS_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;
      }[],
    };

    this.placeholderMap.p2g.forEach((gs, p) => {
      const gr = `${gs} | ${gs} ${p}`;

      result.defs.push({ [p]: gr } as Definition<Kinds>);
      // the gr will introduce an RS conflict, so we need to resolve it
      result.rs.push({
        reducerRule: { [p]: `${gs}` } as Definition<Kinds>,
        anotherRule: { [p]: `${gs} ${p}` } as Definition<Kinds>,
        // in most cases we want the `+*?` to be greedy
        options: { next: "*", accept: false },
      });

      if (debug) {
        logger(`[AdvancedBuilder.build] Generated: ${p}: \`${gr}\``);
        logger(
          `[AdvancedBuilder.build] Generated Resolver: { ${p}: \`${gs}\`} | { ${p}: \`${gs} ${p}\`}, { next: "*", accept: false }`,
        );
      }
    });

    return result;
  }
}
