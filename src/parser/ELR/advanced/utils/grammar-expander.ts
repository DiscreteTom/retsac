import type { Logger } from "../../../../logger";
import type { IParser } from "../../../model";
import type { Definition, RS_ResolverOptions } from "../../builder";
import { InvalidGrammarRuleError } from "../error";
import type { PlaceholderMap } from "./grammar-parser-factory";
import { grammarParserFactory, entry } from "./grammar-parser-factory";
import { data } from "./serialized-grammar-parser-data";

export class GrammarExpander<
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> {
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
    this.parser = parserBuilder.build({
      lexer,
      entry,
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
        options: RS_ResolverOptions<
          ASTData,
          ErrorType,
          Kinds,
          LexerKinds,
          LexerError
        >;
      }[],
    };
    const res = this.parser.reset().parseAll(s);

    if (!res.accept || !this.allParsed())
      throw new InvalidGrammarRuleError(s, this.parser.lexer.getRest());

    const expanded = res.buffer[0].traverse()!;

    const resultDef: Definition<Kinds> = {};
    resultDef[NT] = expanded;
    if (debug)
      logger(
        `[AdvancedBuilder] Expanded: { ${NT}: \`${expanded.join(" | ")}\` }`,
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
              `[AdvancedBuilder] Generated RS resolver: { ${NT}: \`${reducerRule}\`} vs { ${NT}: \`${anotherRule}\`}, { next: "*", accept: false }`,
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
        options: RS_ResolverOptions<
          ASTData,
          ErrorType,
          Kinds,
          LexerKinds,
          LexerError
        >;
      }[],
    };

    this.placeholderMap.p2g.forEach((gs, p) => {
      const gr = gs.map((s) => `${s} | ${s} ${p}`).join(" | ");

      result.defs.push({ [p]: gr } as Definition<Kinds>);
      // the gr will introduce an RS conflict, so we need to resolve it
      result.rs.push(
        ...gs.map((s) => ({
          reducerRule: { [p]: `${s}` } as Definition<Kinds>,
          anotherRule: { [p]: `${s} ${p}` } as Definition<Kinds>,
          // in most cases we want the `+*?` to be greedy
          // TODO: check if the rejecter if valid?
          // e.g. invalid rule: { exps: `exp (',' exp)* ','?` }
          options: { next: "*", accept: false },
        })),
      );

      if (debug) {
        logger(
          `[AdvancedBuilder] Generated placeholder grammar rule: { ${p}: \`${gr}\` }`,
        );
        gs.forEach((s) =>
          logger(
            `[AdvancedBuilder] Generated RS resolver: { ${p}: \`${s}\`} | { ${p}: \`${s} ${p}\`}, { next: "*", accept: false }`,
          ),
        );
      }
    });

    return result;
  }
}
