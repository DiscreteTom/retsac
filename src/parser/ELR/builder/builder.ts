import type {
  GrammarRule,
  BuildOptions,
  IParserBuilder,
  Conflict,
  SerializableParserData,
  Condition,
  ResolvedConflict,
  BuilderDecorator,
} from "../model";
import {
  ConflictType,
  GrammarRepo,
  GrammarSet,
  ResolverHydrationType,
} from "../model";
import { GrammarRuleNotFoundError, NoEntryNTError } from "./error";
import type { DefinitionContextBuilderDecorator } from "./ctx-builder";
import { DefinitionContextBuilder } from "./ctx-builder";
import {
  DefinitionAssociativity,
  DefinitionGroupWithAssociativity,
  TempGrammar,
  TempGrammarType,
} from "./model";
import type {
  ParserBuilderData,
  RS_ResolverOptions,
  Definition,
  DefinitionContext,
  RR_ResolverOptions,
} from "./model";
import { DFA, DFABuilder } from "../DFA";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexer,
  IReadonlyLexerCore,
} from "../../../lexer";
import { appendConflicts, getUnresolvedConflicts } from "./utils/conflict";
import { Parser } from "../parser";
import { defaultLogger, type Logger } from "../../../logger";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AdvancedBuilder } from "../advanced/builder";
import {
  checkConflicts,
  checkHydrateHash,
  checkRollbacks,
  checkSymbols,
} from "./check";
import { buildSerializable, calculateHash } from "./utils/serialize";

/**
 * Builder for ELR parsers.
 *
 * Use `useLexer` to set the lexer, use `define` to define grammar rules, use `build` to get parser.
 *
 * When build, it's recommended to set `checkAll` to `true` in development environment.
 */
export class ParserBuilder<
  Kinds extends string = never,
  ASTData = never,
  ErrorType = never,
  LexerDataBindings extends GeneralTokenDataBinding = never,
  LexerActionState = never,
  LexerError = never,
> implements
    IParserBuilder<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >
{
  /**
   * For most cases, this is used by {@link AdvancedBuilder} for cascading query.
   * You can also customize this.
   */
  protected readonly cascadeQueryPrefix?: string;
  protected readonly builderData: ParserBuilderData<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >[];
  protected _lexer: ILexer<LexerDataBindings, LexerActionState, LexerError>;

  constructor(options?: {
    /**
     * For most cases, this is used by {@link AdvancedBuilder} for cascading query.
     * You can also customize this.
     */
    cascadeQueryPrefix?: string;
  }) {
    this.builderData = [];
    this.cascadeQueryPrefix = options?.cascadeQueryPrefix;
  }

  lexer<
    NewLexerDataBindings extends [Kinds] extends [never]
      ? [LexerDataBindings] extends [never]
        ? GeneralTokenDataBinding
        : never
      : never,
    NewLexerActionState,
    NewLexerError,
  >(
    lexer: ILexer<NewLexerDataBindings, NewLexerActionState, NewLexerError>,
  ): IParserBuilder<
    Kinds,
    ASTData,
    ErrorType,
    NewLexerDataBindings,
    NewLexerActionState,
    NewLexerError
  > {
    const _this = this as unknown as ParserBuilder<
      Kinds,
      ASTData,
      ErrorType,
      NewLexerDataBindings,
      NewLexerActionState,
      NewLexerError
    >;
    _this._lexer = lexer;
    return _this;
  }

  data<
    NewASTData extends [Kinds] extends [never]
      ? [ASTData] extends [never]
        ? unknown
        : never
      : never,
  >(
    _data?: NewASTData,
  ): IParserBuilder<
    Kinds,
    NewASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  > {
    return this as unknown as ParserBuilder<
      Kinds,
      NewASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >;
  }

  load(
    data: readonly ParserBuilderData<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >[],
  ) {
    this.builderData.push(...data);
    return this as IParserBuilder<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >;
  }

  define<Append extends string>(
    defs: Definition<Kinds | Append>,
    decorator?: DefinitionContextBuilderDecorator<
      Kinds | Append,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ): IParserBuilder<
    Kinds | Append,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  > {
    (
      this.builderData as ParserBuilderData<
        Kinds | Append,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >[]
    ).push({
      defs,
      ctxBuilder: decorator?.(new DefinitionContextBuilder()),
      resolveOnly: false,
      hydrationId: this.builderData.length,
    });
    return this as IParserBuilder<
      Kinds | Append,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >;
  }

  private buildDFA(
    entryNTs: ReadonlySet<Kinds>,
    lexer: IReadonlyLexerCore<LexerDataBindings, LexerActionState, LexerError>,
    printAll: boolean,
    debug: boolean,
    logger: Logger,
    rollback: boolean,
    reLex: boolean,
  ) {
    if (entryNTs.size === 0) {
      const e = new NoEntryNTError();
      if (printAll) logger.log({ entity: "Parser", message: e.message });
      else throw e;
    }

    const repo = new GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>();

    // build the DFA
    const {
      grs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      cs,
      allStates,
      NTs,
      resolvedTemps,
    } = DFABuilder.prepare<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >(
      repo,
      lexer,
      entryNTs,
      this.builderData as ParserBuilderData<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >[],
      printAll,
      logger,
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
    );

    // transform resolved temp conflicts to resolved conflicts
    // and append into grammar rules
    resolvedTemps.forEach((r) => {
      // find the grammar rules
      const reducerRule = grs.get(r.reducerRule);
      if (!reducerRule) {
        const e = new GrammarRuleNotFoundError(r.reducerRule);
        if (printAll) {
          logger.log({ entity: "Parser", message: e.message });
          return;
        } else throw e;
      }
      const anotherRule = grs.get(r.anotherRule);
      if (!anotherRule) {
        const e = new GrammarRuleNotFoundError(r.anotherRule);
        if (printAll) {
          logger.log({ entity: "Parser", message: e.message });
          return;
        } else throw e;
      }

      const next =
        r.options.next === "*"
          ? ("*" as const)
          : r.options.next === undefined
          ? new GrammarSet<Kinds, ExtractKinds<LexerDataBindings>>()
          : new GrammarSet<Kinds, ExtractKinds<LexerDataBindings>>(
              r.options.next.map((n) =>
                new TempGrammar({
                  type:
                    n.startsWith('"') || n.startsWith("'")
                      ? TempGrammarType.LITERAL
                      : TempGrammarType.GRAMMAR,
                  content:
                    n.startsWith('"') || n.startsWith("'") ? n.slice(1, -1) : n,
                }).toGrammar<
                  Kinds,
                  LexerDataBindings,
                  LexerActionState,
                  LexerError
                >(repo, lexer, printAll, logger, NTs.has(n as Kinds)),
              ),
            );

      const accepter = r.options.accept ?? true;
      const resolved: ResolvedConflict<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      > =
        typeof accepter === "boolean"
          ? {
              anotherRule,
              type: r.type,
              next,
              handleEnd:
                r.type === ConflictType.REDUCE_REDUCE
                  ? r.options.handleEnd ?? false
                  : false,
              accepter,
              hydrationId: undefined,
            }
          : {
              anotherRule,
              type: r.type,
              next,
              handleEnd:
                r.type === ConflictType.REDUCE_REDUCE
                  ? r.options.handleEnd ?? false
                  : false,
              accepter,
              hydrationId: r.hydrationId,
            };

      reducerRule.resolved.push(resolved);
    });

    // calculate and store conflicts in grs, they will be used during parsing
    appendConflicts(repo, entryNTs, grs, dfa, debug, logger);

    // update conflicts with related resolvers
    grs.grammarRules.forEach((reducerRule) => {
      reducerRule.conflicts.forEach((c) => {
        reducerRule.resolved.forEach((resolved) => {
          if (
            c.type === resolved.type &&
            c.anotherRule === resolved.anotherRule &&
            // next match or both handle end
            (resolved.next === "*" ||
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

  private generateResolvers(
    unresolved: Map<
      GrammarRule<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
      Conflict<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >[]
    >,
    style: "builder" | "context",
  ) {
    if (style === "builder") {
      const res = [] as string[];
      unresolved.forEach((v, reducerRule) => {
        const txt = v
          .map(
            (c) =>
              `.resolve${c.type === ConflictType.REDUCE_SHIFT ? "RS" : "RR"}(${
                reducerRule.strWithGrammarName.value
              }, ${c.anotherRule.strWithGrammarName.value}, { ${
                c.next.grammars.size > 0
                  ? `next: \`${c.next
                      .map((g) => g.grammarStrWithName)
                      .join(" ")}\`, `
                  : ""
              }${c.handleEnd ? `handleEnd: true, ` : ""}accept: TODO })`,
          )
          .join("\n");
        res.push(txt);
      });

      return res.join("\n");
    } else {
      const res = [] as string[];
      unresolved.forEach((v, k) => {
        const txt =
          `=== ${k} ===\n` +
          v
            .map(
              (c) =>
                `ELR.resolve${
                  c.type === ConflictType.REDUCE_SHIFT ? "RS" : "RR"
                }(${c.anotherRule.strWithGrammarName.value}, { ${
                  c.next.grammars.size > 0
                    ? `next: \`${c.next
                        .map((g) => g.grammarStrWithName)
                        .join(" ")}\`, `
                    : ""
                }${c.handleEnd ? `handleEnd: true, ` : ""}accept: TODO })`,
            )
            .join(",\n");
        res.push(txt);
      });

      return res.join("\n\n");
    }
  }

  resolveRS(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RS_ResolverOptions<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ) {
    this.builderData.push({
      defs: reducerRule,
      ctxBuilder: new DefinitionContextBuilder<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >().resolveRS(anotherRule, options),
      resolveOnly: true,
      hydrationId: this.builderData.length,
    });

    return this;
  }

  resolveRR(
    reducerRule: Definition<Kinds>,
    anotherRule: Definition<Kinds>,
    options: RR_ResolverOptions<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ) {
    this.builderData.push({
      defs: reducerRule,
      ctxBuilder: new DefinitionContextBuilder<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >().resolveRR(anotherRule, options),
      resolveOnly: true,
      hydrationId: this.builderData.length,
    });

    return this;
  }

  use<AppendKinds extends string>(
    f: BuilderDecorator<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError,
      AppendKinds
    >,
  ): IParserBuilder<
    Kinds | AppendKinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  > {
    return f(this);
  }

  priority(
    ...groups: (
      | Definition<Kinds>
      | Definition<Kinds>[]
      | DefinitionGroupWithAssociativity<Kinds>
    )[]
  ) {
    // grammar rules with higher priority will always be reduced first
    // e.g. priority([{ exp: `exp '*' exp` }], [{ exp: `exp '+' exp` }])
    groups.forEach((higherDefs, higherIndex) => {
      groups.forEach((lowerDefs, lowerIndex) => {
        // lowerIndex should be greater than higherIndex
        // since higher priority defs should be defined before lower priority defs
        if (lowerIndex <= higherIndex) return;

        // higherDefs: [{ exp: `exp '*' exp` }]
        (higherDefs instanceof DefinitionGroupWithAssociativity
          ? higherDefs.defs
          : higherDefs instanceof Array
          ? higherDefs
          : [higherDefs]
        ).forEach(
          // higher: { exp: `exp '*' exp` }
          (higher) => {
            // lowerDefs: [{ exp: `exp '+' exp` }]
            (lowerDefs instanceof DefinitionGroupWithAssociativity
              ? lowerDefs.defs
              : lowerDefs instanceof Array
              ? lowerDefs
              : [lowerDefs]
            ).forEach(
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
              },
            );
          },
        );
      });
    });

    // grammar rules with the same priority will be accepted by associativity
    // e.g. priority([{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }])
    groups.forEach((group) => {
      const defs =
        group instanceof DefinitionGroupWithAssociativity
          ? group.defs
          : group instanceof Array
          ? group
          : [group];
      const associativity =
        group instanceof DefinitionGroupWithAssociativity
          ? group.associativity
          : DefinitionAssociativity.LeftToRight;

      defs.forEach((d1) => {
        defs.forEach((d2) => {
          // even d1 === d2, we still need to resolve them
          // e.g. { exp: `exp '+' exp` } need to resolve RS conflicts with it self.
          this.resolveRS(d1, d2, {
            next: `*`,
            accept: associativity === DefinitionAssociativity.LeftToRight,
          });

          // the following conflicts are only valid if d1 !== d2
          if (d1 !== d2) {
            this.resolveRR(d1, d2, {
              next: `*`,
              accept: associativity === DefinitionAssociativity.LeftToRight,
              handleEnd: true,
            });
            this.resolveRS(d2, d1, {
              next: `*`,
              accept: associativity === DefinitionAssociativity.LeftToRight,
            });
            this.resolveRR(d2, d1, {
              next: `*`,
              accept: associativity === DefinitionAssociativity.LeftToRight,
              handleEnd: true,
            });
          }
        });
      });
    });
    return this;
  }

  private restoreAndHydrate(
    data: SerializableParserData<Kinds, LexerDataBindings>,
    options: Parameters<typeof DFA.fromJSON>[1],
  ) {
    const dfa = DFA.fromJSON<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >(data.data.dfa, options);
    const ctxs = this.builderData.map(
      (d) => d.ctxBuilder?.build(),
    ) as DefinitionContext<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >[];

    // hydrate grammar rules with user defined functions & resolvers
    dfa.grammarRules.grammarRules.forEach((gr) => {
      gr.rollback = ctxs[gr.hydrationId]?.rollback;
      gr.rejecter = ctxs[gr.hydrationId]?.rejecter;
      gr.callback = ctxs[gr.hydrationId]?.callback;
      gr.commit = ctxs[gr.hydrationId]?.commit;
      gr.traverser = ctxs[gr.hydrationId]?.traverser;

      gr.resolved.forEach((r) => {
        if (r.hydrationId !== undefined) {
          r.accepter = (
            r.hydrationId.type === ResolverHydrationType.BUILDER
              ? ctxs[r.hydrationId.index].resolved[0].accept // resolvers in builder mode only have one resolver
              : ctxs[gr.hydrationId].resolved[r.hydrationId.index].accept
          ) as Condition<
            Kinds,
            ASTData,
            ErrorType,
            LexerDataBindings,
            LexerActionState,
            LexerError
          >;
        }
      });
    });

    return { dfa, NTs: dfa.NTs as ReadonlySet<Kinds>, grs: dfa.grammarRules };
  }

  build(options: BuildOptions<Kinds, LexerDataBindings>) {
    const debug = options.debug ?? false;
    const logger = options.logger ?? defaultLogger;
    const printAll = options.printAll ?? false;
    const rollback = options.rollback ?? false;
    const reLex = options.reLex ?? true;
    const autoCommit = options.autoCommit ?? false;
    const ignoreEntryFollow = options.ignoreEntryFollow ?? false;
    const lexer = this._lexer.clone(); // prevent modify the builder

    const entryNTs = new Set(
      options.entry instanceof Array ? options.entry : [options.entry],
    ) as ReadonlySet<Kinds>;

    // hydrate or build dfa
    const { dfa, NTs, grs } =
      options.hydrate === undefined
        ? this.buildDFA(
            entryNTs,
            lexer.core,
            printAll,
            debug,
            logger,
            rollback,
            reLex,
          )
        : this.restoreAndHydrate(options.hydrate, {
            debug,
            logger,
            rollback,
            reLex,
          });

    // check symbols first
    if (options.checkAll || options.checkSymbols)
      checkSymbols(entryNTs, NTs, lexer.getTokenKinds(), grs, printAll, logger);

    // deal with conflicts
    let resolvers: string | undefined = undefined;
    if (
      options.checkAll ||
      options.checkConflicts ||
      options.generateResolvers
    ) {
      // resolved conflicts are already stored in grs in this.buildDFA
      const unresolved = getUnresolvedConflicts(grs, debug, logger);

      if (options.generateResolvers !== undefined)
        resolvers = this.generateResolvers(
          unresolved,
          options.generateResolvers,
        );

      if (options.checkAll || options.checkConflicts)
        checkConflicts(dfa.followSets, unresolved, grs, printAll, logger);
    }

    // ensure no rollback if rollback is not enabled
    if ((options.checkAll || options.checkRollback) && !rollback)
      checkRollbacks(grs, printAll, logger);

    // check hydrate hash
    if (
      (options.checkAll || options.checkHydrate) &&
      options.hydrate !== undefined
    )
      checkHydrateHash(
        calculateHash(
          this.builderData,
          entryNTs,
          lexer,
          this.cascadeQueryPrefix,
        ) !== options.hydrate.hash,
        printAll,
        logger,
      );

    return {
      parser: new Parser(
        dfa,
        lexer,
        autoCommit,
        ignoreEntryFollow,
        debug,
        logger,
      ) as unknown as [LexerDataBindings] extends [never]
        ? never // if no lexer, no parser
        : Parser<
            Kinds,
            ASTData,
            ErrorType,
            LexerDataBindings,
            LexerActionState,
            LexerError
          >,
      serializable:
        options.serialize ?? false
          ? ((options.hydrate ??
              buildSerializable(
                this.builderData,
                dfa,
                entryNTs,
                lexer,
                this.cascadeQueryPrefix,
              )) as Readonly<SerializableParserData<Kinds, LexerDataBindings>>)
          : undefined,
      mermaid: options.mermaid ?? false ? dfa.toMermaid() : undefined,
      resolvers,
    };
  }
}
