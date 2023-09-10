import {
  GrammarRule,
  BuilderDecorator,
  BuildOptions,
  IParserBuilder,
  Conflict,
  ConflictType,
  GrammarRepo,
  GrammarRuleRepo,
  SerializableParserData,
  Condition,
  GrammarSet,
  ResolverHydrationType,
} from "../model";
import {
  ConflictError,
  DuplicatedDefinitionError,
  GrammarRuleNotFoundError,
  NextGrammarNotFoundError,
  NoEntryNTError,
  NoSuchConflictError,
  RollbackDefinedWhileNotEnabledError,
  UnknownEntryNTError,
  UnknownGrammarError,
} from "./error";
import { DefinitionContextBuilder } from "./ctx-builder";
import {
  ParserBuilderData,
  ResolvedTempConflict,
  RR_ResolverOptions,
  RS_ResolverOptions,
  Definition,
  DefinitionContext,
} from "./model";
import { defToTempGRs } from "./utils/definition";
import { DFA, DFABuilder } from "../DFA";
import { ILexer } from "../../../lexer";
import { getConflicts, getUnresolvedConflicts } from "./utils/conflict";
import { Parser } from "../parser";
import { Logger } from "../../../model";

// type only import for js doc
import type { AdvancedBuilder } from "../advanced/builder";

/**
 * Builder for ELR parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * When build, it's recommended to set `checkAll` to `true` when developing.
 */
export class ParserBuilder<ASTData, Kinds extends string = never>
  implements IParserBuilder<ASTData, Kinds>
{
  /**
   * Use protected for {@link AdvancedBuilder}
   */
  protected readonly data: ParserBuilderData<ASTData, Kinds> = [];
  private readonly entryNTs: Set<string>;
  /**
   * Resolved temporary conflicts.
   * This will be filled in 2 places:
   *
   * 1. When `builder.resolveRS` or `builder.resolveRR` is called, the resolved conflicts will be pushed to this array.
   * 2. When `builder.build` is called, the resolved conflicts in DefinitionContext will be transformed and pushed to this.
   */
  private readonly resolvedTemp: ResolvedTempConflict<ASTData, Kinds>[];
  /**
   * For most cases, this is used by {@link AdvancedBuilder} for cascading query.
   * You can also customize this.
   */
  private readonly cascadeQueryPrefix?: string;
  private _serializable?: SerializableParserData;

  constructor(options?: {
    /**
     * For most cases, this is used by {@link AdvancedBuilder} for cascading query.
     * You can also customize this.
     */
    cascadeQueryPrefix?: string;
  }) {
    this.entryNTs = new Set();
    this.resolvedTemp = [];
    this.cascadeQueryPrefix = options?.cascadeQueryPrefix;
  }

  entry<Append extends string>(
    ...defs: Append[]
  ): IParserBuilder<ASTData, Kinds | Append> {
    this.entryNTs.clear();
    defs.forEach((d) => this.entryNTs.add(d));
    return this as IParserBuilder<ASTData, Kinds | Append>;
  }

  /**
   * Definition syntax:
   * - `A | B` means `A` or `B`
   * - `A B` means `A` then `B`
   * - `'xxx'` or `"xxx"` means literal string `xxx`
   *   - Escaped quote is supported. E.g.: `'abc\'def'`
   *
   * E.g.:
   *
   * ```js
   * define({ exp: `A B | 'xxx' B` })
   * // means `A B` or `'xxx' B`, and reduce to `exp`
   * // equals to:
   * define({ exp: [`A B`, `'xxx' B`] })
   * ```
   */
  define<Append extends string>(
    defs: Definition<Kinds | Append>,
    ctxBuilder?: DefinitionContextBuilder<ASTData, Kinds | Append>
  ): IParserBuilder<ASTData, Kinds | Append> {
    (this.data as ParserBuilderData<ASTData, Kinds | Append>).push({
      defs,
      ctxBuilder,
    });
    return this as IParserBuilder<ASTData, Kinds | Append>;
  }

  /**
   * Ensure all T/NTs have their definitions, and no duplication, and all literals are valid.
   * If ok, return this.
   */
  private checkSymbols<LexerKinds extends string>(
    NTs: ReadonlySet<string>,
    Ts: ReadonlySet<string>,
    grs: GrammarRuleRepo<ASTData, Kinds | LexerKinds>,
    lexer: Readonly<ILexer<any, any>>,
    printAll: boolean,
    logger: Logger
  ) {
    // all grammar symbols should have its definition, either in NTs or Ts
    grs.grammarRules.forEach((gr) => {
      gr.rule.forEach((g) => {
        if (g.text == undefined) {
          // N/NT
          if (!Ts.has(g.kind) && !NTs.has(g.kind)) {
            const e = new UnknownGrammarError(g.kind);
            if (printAll) logger(e.message);
            else throw e;
          }
        }
      });
    });

    // check duplication
    NTs.forEach((name) => {
      if (Ts.has(name)) {
        const e = new DuplicatedDefinitionError(name);
        if (printAll) logger(e.message);
        else throw e;
      }
    });

    // entry NTs must in NTs
    this.entryNTs.forEach((NT) => {
      if (!NTs.has(NT)) {
        const e = new UnknownEntryNTError(NT);
        if (printAll) logger(e.message);
        else throw e;
      }
    });

    // all literals must be able to be tokenized by lexer
    // this is this already checked when GrammarRepo create the grammar
    // lexer = lexer.dryClone();
    // grs.grammarRules.forEach((gr) => {
    //   gr.rule.forEach((grammar) => {
    //     if (grammar.text != undefined) {
    //       if (lexer.reset().lex(grammar.text!) == null) {
    //         const e = new InvalidLiteralError(grammar.text!);
    //         if (printAll) logger(e.message);
    //         else throw e;
    //       }
    //     }
    //   });
    // });

    return this;
  }

  private buildDFA<LexerKinds extends string>(
    lexer: ILexer<any, LexerKinds>,
    printAll: boolean,
    debug: boolean,
    logger: Logger,
    rollback: boolean,
    reLex: boolean
  ) {
    if (this.entryNTs.size == 0) {
      const e = new NoEntryNTError();
      if (printAll) logger(e.message);
      else throw e;
    }

    const repo = new GrammarRepo();

    // build the DFA
    const {
      grs,
      entryNTs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      cs,
      allStates,
      NTs,
    } = DFABuilder.prepare<ASTData, Kinds | LexerKinds>(
      repo,
      lexer,
      this.entryNTs,
      this.data as ParserBuilderData<ASTData, Kinds | LexerKinds>,
      this.resolvedTemp as ResolvedTempConflict<ASTData, Kinds | LexerKinds>[],
      printAll,
      logger
    );
    const dfa = new DFA(
      grs,
      entryNTs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      cs,
      allStates,
      repo,
      NTs,
      this.cascadeQueryPrefix,
      rollback,
      reLex,
      debug,
      logger
    );

    // transform resolved temp conflicts to resolved conflicts
    // and append into grammar rules
    this.resolvedTemp.forEach((r) => {
      // find the grammar rules
      const reducerRule = grs.get(r.reducerRule);
      if (!reducerRule) {
        const e = new GrammarRuleNotFoundError(r.reducerRule);
        if (printAll) {
          logger(e.message);
          return;
        } else throw e;
      }
      const anotherRule = grs.get(r.anotherRule);
      if (!anotherRule) {
        const e = new GrammarRuleNotFoundError(r.anotherRule);
        if (printAll) {
          logger(e.message);
          return;
        } else throw e;
      }

      const next =
        r.options.next == "*"
          ? ("*" as const)
          : new GrammarSet(
              // TODO: use a dedicated lexer to parse next
              defToTempGRs({
                "": r.options.next ?? "",
              } as Definition<Kinds>)[0]?.rule.map((g) =>
                g.toGrammar(repo, lexer, printAll, logger, NTs.has(g.content))
              ) ?? []
            );

      const resolved = {
        anotherRule,
        type: r.type,
        next,
        handleEnd:
          r.type == ConflictType.REDUCE_REDUCE
            ? r.options.handleEnd ?? false
            : false,
        accepter:
          (r.options.accept as
            | boolean
            | Condition<ASTData, Kinds | LexerKinds>
            | undefined) ?? true,
        hydrationId: r.hydrationId,
      };

      reducerRule.resolved.push(resolved);
    });

    // conflicts are stored in grs, they will be used during parsing
    getConflicts(repo, this.entryNTs, grs, dfa, debug, logger);
    // update conflicts with related resolvers
    grs.grammarRules.forEach((reducerRule) => {
      reducerRule.conflicts.forEach((c) => {
        reducerRule.resolved.forEach((resolved) => {
          if (
            c.type == resolved.type &&
            c.anotherRule == resolved.anotherRule &&
            // next match or both handle end
            (resolved.next == "*" ||
              c.next.overlap(resolved.next).grammars.size > 0 ||
              (c.handleEnd && resolved.handleEnd))
          ) {
            c.resolvers.push(resolved);
          }
        });
      });
    });

    return {
      grs,
      dfa,
      NTs,
    };
  }

  build<LexerKinds extends string>(
    lexer: ILexer<any, LexerKinds>,
    options?: BuildOptions
  ) {
    const debug = options?.debug ?? false;
    const logger = options?.logger ?? console.log;
    const printAll = options?.printAll ?? false;
    const rollback = options?.rollback ?? false;
    const reLex = options?.reLex ?? true;

    // TODO: optimize pipeline: build/restore -> hydrate -> checks -> serialize
    // maybe we don't need to hydrate when buildDFA?

    // hydrate or build dfa
    const { dfa, NTs, grs } =
      options?.hydrate == undefined
        ? this.buildDFA(lexer, printAll, debug, logger, rollback, reLex)
        : this.restoreAndHydrate<LexerKinds>(options.hydrate, {
            debug,
            logger,
            rollback,
            reLex,
          });

    // check symbols first
    if (options?.checkAll || options?.checkSymbols)
      this.checkSymbols(
        NTs,
        lexer.getTokenKinds(),
        grs,
        lexer,
        printAll,
        logger
      );

    // deal with conflicts
    if (
      options?.checkAll ||
      options?.checkConflicts ||
      options?.generateResolvers
    ) {
      // resolved conflicts are already stored in grs in this.buildDFA
      const unresolved = getUnresolvedConflicts(grs, debug, logger);

      if (options?.generateResolvers !== undefined)
        this.generateResolvers(unresolved, options.generateResolvers, logger);

      if (options?.checkAll || options?.checkConflicts)
        this.checkConflicts(dfa, unresolved, grs, printAll, logger);
    }

    // ensure no rollback if rollback is not enabled
    if ((options?.checkAll || options?.checkRollback) && !rollback) {
      grs.grammarRules.forEach((gr) => {
        if (gr.rollback !== undefined) {
          const e = new RollbackDefinedWhileNotEnabledError(gr);
          if (printAll) logger(e);
          else throw e;
        }
      });
    }

    // serialize
    if (options?.serialize ?? false) {
      this._serializable = this.buildSerializable(dfa);
    }

    return new Parser(dfa, lexer);
  }

  /**
   * Ensure all reduce-shift and reduce-reduce conflicts are resolved.
   * If ok, return this.
   *
   * If `printAll` is true, print all conflicts instead of throwing error.
   */
  private checkConflicts<LexerKinds extends string>(
    dfa: DFA<ASTData, Kinds | LexerKinds>,
    unresolved: ReadonlyMap<
      GrammarRule<ASTData, Kinds | LexerKinds>,
      Conflict<ASTData, Kinds | LexerKinds>[]
    >,
    grs: GrammarRuleRepo<ASTData, Kinds | LexerKinds>,
    printAll: boolean,
    logger: Logger
  ) {
    const followSets = dfa.followSets;

    // ensure all conflicts are resolved
    unresolved.forEach((cs, gr) => {
      cs.forEach((c) => {
        const err = new ConflictError(gr, c);
        if (printAll) logger(err.message);
        else throw err;
      });
    });

    // ensure all grammar rules resolved are appeared in the grammar rules
    // this is done in `buildDFA`

    // ensure all next grammars in resolved rules indeed in the follow set of the reducer rule's NT
    grs.grammarRules.forEach((reducerRule) => {
      reducerRule.resolved.forEach((g) => {
        if (g.next == "*") return;
        g.next.grammars.forEach((n) => {
          if (!followSets.get(reducerRule.NT)!.has(n)) {
            const err = new NextGrammarNotFoundError(n, reducerRule.NT);
            if (printAll) logger(err.message);
            else throw err;
          }
        });
      });
    });

    // ensure all resolved are indeed conflicts
    grs.grammarRules.forEach((reducerRule) => {
      reducerRule.resolved.forEach((c) => {
        // check next
        if (c.next != "*")
          c.next.grammars.forEach((n) => {
            if (
              !reducerRule.conflicts.some(
                (conflict) =>
                  c.anotherRule == conflict.anotherRule &&
                  c.type == conflict.type &&
                  conflict.next.some((nn) => n.equalWithoutName(nn)) // don't use `==` here since we don't want to compare grammar name
              )
            ) {
              const err = new NoSuchConflictError(
                reducerRule,
                c.anotherRule,
                c.type,
                [n],
                false
              );
              if (printAll) logger(err.message);
              else throw err;
            }
          });
        // check handleEnd
        if (
          c.next != "*" &&
          c.handleEnd &&
          reducerRule.conflicts.some(
            (conflict) =>
              c.anotherRule == conflict.anotherRule &&
              c.type == conflict.type &&
              conflict.handleEnd
          )
        ) {
          const err = new NoSuchConflictError(
            reducerRule,
            c.anotherRule,
            c.type,
            [],
            true
          );
          if (printAll) logger(err.message);
          else throw err;
        }
      });
    });
    return this;
  }

  private generateResolvers<LexerKinds extends string>(
    unresolved: Map<
      GrammarRule<ASTData, Kinds | LexerKinds>,
      Conflict<ASTData, Kinds | LexerKinds>[]
    >,
    style: "builder" | "context",
    logger: Logger
  ) {
    if (style == "builder") {
      unresolved.forEach((v, reducerRule) => {
        const txt = v
          .map(
            (c) =>
              `.resolve${c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"}(${
                reducerRule.strWithGrammarName.value
              }, ${c.anotherRule.strWithGrammarName.value}, { ${
                c.next.grammars.size > 0
                  ? `next: \`${c.next
                      .map((g) => g.grammarStrWithName)
                      .join(" ")}\`, `
                  : ""
              }${c.handleEnd ? `handleEnd: true, ` : ""}reduce: true })`
          )
          .join("\n");
        logger(txt);
      });
    } else {
      unresolved.forEach((v, k) => {
        const txt =
          `=== ${k} ===\nLR` +
          v
            .map(
              (c) =>
                `.resolve${c.type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"}(${
                  c.anotherRule.strWithGrammarName.value
                }, { ${
                  c.next.grammars.size > 0
                    ? `next: \`${c.next
                        .map((g) => g.grammarStrWithName)
                        .join(" ")}\`, `
                    : ""
                }${c.handleEnd ? `handleEnd: true, ` : ""}reduce: true })`
            )
            .join("\n  ");
        logger(txt);
        logger(""); // add a blank line
      });
    }

    return this;
  }

  resolveRS(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, Kinds>
  ) {
    // we don't need grammar rule's hydration ID here
    // since we only want to record conflicts, instead of creating new grammar rules
    const reducerRules = defToTempGRs<ASTData, Kinds>(reducerRule);
    const anotherRules = defToTempGRs<ASTData, Kinds>(anotherRule);
    reducerRules.forEach((r) => {
      anotherRules.forEach((a) => {
        this.resolvedTemp.push({
          type: ConflictType.REDUCE_SHIFT,
          reducerRule: r,
          anotherRule: a,
          options,
          hydrationId: {
            type: ResolverHydrationType.BUILDER,
            index: this.resolvedTemp.length,
          },
        });
      });
    });
    return this;
  }

  resolveRR(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, Kinds>
  ) {
    // we don't need grammar rule's hydration ID here
    // since we only want to record conflicts, instead of creating new grammar rules
    const reducerRules = defToTempGRs<ASTData, Kinds>(reducerRule);
    const anotherRules = defToTempGRs<ASTData, Kinds>(anotherRule);
    reducerRules.forEach((r) => {
      anotherRules.forEach((a) => {
        this.resolvedTemp.push({
          type: ConflictType.REDUCE_REDUCE,
          reducerRule: r,
          anotherRule: a,
          options,
          hydrationId: {
            type: ResolverHydrationType.BUILDER,
            index: this.resolvedTemp.length,
          },
        });
      });
    });
    return this;
  }

  use<Append extends string>(
    f: BuilderDecorator<ASTData, Kinds, Append>
  ): IParserBuilder<ASTData, Kinds | Append> {
    return f(this);
  }

  priority(...groups: (Definition<Kinds> | Definition<Kinds>[])[]) {
    // grammar rules with higher priority will always be reduced first
    // e.g. priority([{ exp: `exp '*' exp` }], [{ exp: `exp '+' exp` }])
    groups.forEach((higherDefs, higherIndex) => {
      groups.forEach((lowerDefs, lowerIndex) => {
        // lowerIndex should be greater than higherIndex
        // since higher priority defs should be defined before lower priority defs
        if (lowerIndex <= higherIndex) return;

        // higherDefs: [{ exp: `exp '*' exp` }]
        (higherDefs instanceof Array ? higherDefs : [higherDefs]).forEach(
          // higher: { exp: `exp '*' exp` }
          (higher) => {
            // lowerDefs: [{ exp: `exp '+' exp` }]
            (lowerDefs instanceof Array ? lowerDefs : [lowerDefs]).forEach(
              // lower: { exp: `exp '+' exp` }
              (lower) => {
                this.resolveRS(higher, lower, { next: `*`, accept: true });
                this.resolveRR(higher, lower, {
                  next: `*`,
                  accept: true,
                  handleEnd: true,
                });
                this.resolveRS(lower, higher, { next: `*`, accept: false });
                this.resolveRR(lower, higher, {
                  next: `*`,
                  accept: false,
                  handleEnd: true,
                });
              }
            );
          }
        );
      });
    });

    // grammar rules with the same priority will be reduced from left to right
    // e.g. priority([{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }])
    groups.forEach((defs) => {
      if (defs instanceof Array) {
        defs.forEach((d1, i) => {
          defs.forEach((d2, j) => {
            if (i == j) return; // skip itself
            this.resolveRS(d1, d2, { next: `*`, accept: true });
            this.resolveRR(d1, d2, {
              next: `*`,
              accept: true,
              handleEnd: true,
            });
            this.resolveRS(d2, d1, { next: `*`, accept: true });
            this.resolveRR(d2, d1, {
              next: `*`,
              accept: true,
              handleEnd: true,
            });
          });
        });
      }
    });

    return this;
  }

  leftSA(...defs: Definition<Kinds>[]) {
    defs.forEach((def) => {
      this.resolveRS(def, def, { next: `*`, accept: true });
    });
    return this;
  }

  rightSA(...defs: Definition<Kinds>[]) {
    defs.forEach((def) => {
      this.resolveRS(def, def, { next: `*`, accept: false });
    });
    return this;
  }

  private buildSerializable<LexerKinds extends string>(
    dfa: DFA<ASTData, Kinds | LexerKinds>
  ): SerializableParserData {
    return {
      // meta: JSON.stringify({
      //   data: this.data.map((d) => ({
      //     defs: d.defs,
      //   })),
      //   entryNTs: [...this.entryNTs],
      //   resolvedTemp: this.resolvedTemp.map((r) => ({
      //     reducerRule: r.reducerRule.toStringWithGrammarName(),
      //     anotherRule: r.anotherRule.toStringWithGrammarName(),
      //     type: r.type,
      //   })),
      //   cascadeQueryPrefix: this.cascadeQueryPrefix,
      // }),
      data: { dfa: dfa.toJSON() },
    };
  }

  private restoreAndHydrate<LexerKinds extends string>(
    data: SerializableParserData,
    options: Parameters<typeof DFA.fromJSON>[1]
  ) {
    const dfa = DFA.fromJSON<ASTData, Kinds | LexerKinds>(
      data.data.dfa,
      options
    );
    const ctxs = this.data.map((d) =>
      d.ctxBuilder?.build()
    ) as DefinitionContext<ASTData, Kinds | LexerKinds>[];

    // hydrate grammar rules with user defined functions & resolvers
    dfa.grammarRules.grammarRules.forEach((gr) => {
      gr.rollback = ctxs[gr.hydrationId]?.rollback;
      gr.rejecter = ctxs[gr.hydrationId]?.rejecter;
      gr.callback = ctxs[gr.hydrationId]?.callback;
      gr.commit = ctxs[gr.hydrationId]?.commit;
      gr.traverser = ctxs[gr.hydrationId]?.traverser;

      gr.resolved.forEach((r) => {
        r.accepter =
          r.hydrationId.type == ResolverHydrationType.BUILDER
            ? (
                this.resolvedTemp as ResolvedTempConflict<
                  ASTData,
                  Kinds | LexerKinds
                >[]
              )[r.hydrationId.index].options.accept ?? true
            : ctxs[gr.hydrationId]?.resolved?.[r.hydrationId.index]?.accept ??
              true;
      });
    });

    return { dfa, NTs: dfa.NTs, grs: dfa.grammarRules };
  }

  get serializable(): Readonly<SerializableParserData> | undefined {
    return this._serializable;
  }
}
