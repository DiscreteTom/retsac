import type { GeneralTokenDataBinding } from "../../../../lexer";
import type { Logger } from "../../../../logger";
import type { Definition, RS_ResolverOptions } from "../../builder";
import { InvalidGrammarRuleError } from "../error";
import type { PlaceholderMap } from "./grammar-parser-factory";
import { grammarParserFactory, entry } from "./grammar-parser-factory";
import { data } from "./serialized-grammar-parser-data";

export class GrammarExpander<
  NTs extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> {
  readonly placeholderMap: PlaceholderMap;
  /** This parser will expand grammar rules, and collect placeholders for `gr+`. */
  private readonly parser: ReturnType<
    ReturnType<typeof grammarParserFactory>["parserBuilder"]["build"]
  >["parser"];
  readonly placeholderPrefix: string;

  constructor(options: { placeholderPrefix: string }) {
    this.placeholderPrefix = options.placeholderPrefix;

    const { parserBuilder, placeholderMap } = grammarParserFactory(
      this.placeholderPrefix,
    );

    this.placeholderMap = placeholderMap;
    this.parser = parserBuilder.build({
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
    NT: NTs,
    debug: boolean,
    logger: Logger,
    /**
     * Whether to auto resolve R-S conflict.
     */
    resolve: boolean,
  ) {
    const result = {
      defs: [] as Definition<NTs>[],
      rs: [] as {
        reducerRule: Definition<NTs>;
        anotherRule: Definition<NTs>;
        options: RS_ResolverOptions<
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >;
      }[],
    };
    const res = this.parser.reset().parseAll(s);

    if (!res.accept || !this.allParsed())
      throw new InvalidGrammarRuleError(s, this.parser.lexer.getRest());

    const expanded = res.buffer[0].traverse()!;

    const resultDef: Definition<NTs> = {};
    resultDef[NT] = expanded;
    if (debug) {
      const info = {
        grammarRule: `{ ${NT}: \`${expanded.join(" | ")}\` }`,
      };
      logger.log({
        entity: "AdvancedBuilder",
        message: `expanded: ${info.grammarRule}`,
        info,
      });
    }
    result.defs.push(resultDef);

    // auto resolve R-S conflict for generated grammar rules
    // e.g.: { a: `b c?`, d: `a c` } will be expanded into
    // { a: `b | b c`, d: `a c` }
    // found RS conflict: reducer { a: `b` } and shifter { a: `b c` }
    // and `c` is in the follow set of `a` and the first set of `c`
    // so the conflict can't be auto resolved by LR(1) peeking
    // and { a: `b` } and { a: `b c` } will appear in the same state
    // in that case, this conflict can't be auto resolved by DFA state, either
    // so we need to add resolvers here
    if (resolve)
      expanded.forEach((reducerRule, i) => {
        expanded.forEach((anotherRule, j) => {
          if (i === j) return;

          // every 2 rules will generate a resolver
          // this should ensure all RS conflicts are resolved

          result.rs.push({
            reducerRule: { [NT]: reducerRule } as Definition<NTs>,
            anotherRule: { [NT]: anotherRule } as Definition<NTs>,
            // we want the `+*?` to be greedy
            // so the shorter rule (reducer rule) should be rejected
            options: { next: "*", accept: false },
          });
          if (debug) {
            const info = {
              reducerRule: `{ ${NT}: \`${reducerRule}\` }`,
              anotherRule: `{ ${NT}: \`${anotherRule}\` }`,
              next: "*",
              accept: false,
            };
            logger.log({
              entity: "AdvancedBuilder",
              message: `generated RS resolver: ${info.reducerRule} vs ${info.anotherRule}, next: *, accept: false`,
              info,
            });
          }
        });
      });

    return result;
  }

  private allParsed() {
    return (
      !this.parser.lexer.trimStart().hasRest() &&
      this.parser.buffer.length === 1
    );
  }

  resetAll() {
    this.parser.reset();
    this.placeholderMap.reset();
  }

  generatePlaceholderGrammarRules<ASTData, ErrorType>(
    debug: boolean,
    logger: Logger,
  ) {
    const result = {
      defs: [] as Definition<NTs>[],
      rs: [] as {
        reducerRule: Definition<NTs>;
        anotherRule: Definition<NTs>;
        options: RS_ResolverOptions<
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >;
      }[],
    };

    this.placeholderMap.p2g.forEach((gs, p) => {
      const gr = gs.map((s) => `${s} | ${s} ${p}`).join(" | ");

      result.defs.push({ [p]: gr } as Definition<NTs>);
      // the gr will introduce an RS conflict, so we need to resolve it
      result.rs.push(
        ...gs.map((s) => ({
          reducerRule: { [p]: `${s}` } as Definition<NTs>,
          anotherRule: { [p]: `${s} ${p}` } as Definition<NTs>,
          // we want the `+*?` to be greedy
          options: { next: "*" as const, accept: false },
        })),
      );

      if (debug) {
        const info = {
          grammarRule: `{ ${p}: \`${gr}\` }`,
        };
        logger.log({
          entity: "AdvancedBuilder",
          message: `generated placeholder grammar rule: ${info.grammarRule}`,
          info,
        });
        gs.forEach((s) => {
          const info = {
            reducerRule: `{ ${p}: \`${s}\` }`,
            anotherRule: `{ ${p}: \`${s} ${p}\` }`,
            next: "*",
            accept: false,
          };
          logger.log({
            entity: "AdvancedBuilder",
            message: `generated RS resolver: ${info.reducerRule} vs ${info.anotherRule}, next: *, accept: false`,
            info,
          });
        });
      }
    });

    return result;
  }
}
