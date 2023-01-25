import {
  BaseDefinitionContextBuilder,
  ConflictType,
  Definition,
  Reducer,
  RR_ResolverOptions,
} from "../../base";
import { defToTempGRs } from "../../base/builder/utils/definition";
import { ELRCallback, ELRParserContext, ELRRejecter } from "../model";
import { ELRAccepter, ELRTempPartialConflict } from "./model";

export class DefinitionContextBuilder<T> extends BaseDefinitionContextBuilder<
  T,
  string,
  ELRParserContext<T>
> {
  constructor(data?: {
    callback?: ELRCallback<T>;
    rejecter?: ELRRejecter<T>;
    resolved?: ELRTempPartialConflict<T>[];
  }) {
    super(data);
  }

  protected resolve(
    type: ConflictType,
    another: Definition,
    next: string,
    reduce: boolean | ELRAccepter<T>,
    handleEnd: boolean
  ) {
    const anotherRule = defToTempGRs<T, string, ELRParserContext<T>>(
      another
    )[0];
    // TODO: use a dedicated lexer to parse next
    const nextGrammars =
      next.length > 0
        ? defToTempGRs<T, string, ELRParserContext<T>>({ "": next })[0].rule
        : [];

    // append the new rejecter
    this.rejecter((ctx) => {
      // if reach end of input
      if (ctx.after.length == 0) {
        // if handle the end of input
        if (handleEnd)
          return !(reduce instanceof Function ? reduce(ctx) : reduce);
        else return false;
      }
      // else, not the end of input
      // check if any next grammar match the next token
      if (
        nextGrammars.some(
          (g) =>
            ctx.lexer
              .clone() // clone the lexer to avoid changing the original lexer
              .lex({
                expect: {
                  type: g.toGrammar().toASTNode(ctx.lexer).type,
                  text: g.toGrammar().toASTNode(ctx.lexer).text,
                },
              }) != null
        )
      )
        return !(reduce instanceof Function ? reduce(ctx) : reduce);
      return false;
    });

    // append the new resolved conflict
    this.resolved.push({
      type,
      anotherRule,
      next: nextGrammars,
      handleEnd: handleEnd,
    });

    return this;
  }

  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-S conflict.
   */
  static resolveRS<T>(
    another: Definition,
    options: {
      next: string;
      reduce?: boolean | ELRAccepter<T>;
    }
  ) {
    return new DefinitionContextBuilder<T>({}).resolveRS(another, options);
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<T>(
    another: Definition,
    options: RR_ResolverOptions<T, string, ELRParserContext<T>>
  ) {
    return new DefinitionContextBuilder<T>({}).resolveRR(another, options);
  }
  /** Create a new DefinitionContextBuilder with the new callback appended. */
  static callback<T>(f: ELRCallback<T>) {
    return new DefinitionContextBuilder<T>({}).callback(f);
  }
  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  static rejecter<T>(f: ELRRejecter<T>) {
    return new DefinitionContextBuilder<T>({}).rejecter(f);
  }
  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  static reducer<T>(f: Reducer<T, ELRParserContext<T>>) {
    return new DefinitionContextBuilder<T>({}).reducer(f);
  }
  /** Create a new DefinitionContextBuilder with the new rollback function appended. */
  static rollback<T>(f: ELRCallback<T>) {
    return new DefinitionContextBuilder<T>({}).rollback(f);
  }
  /** Create a new DefinitionContextBuilder which will call `parser.commit` if the grammar rule is accepted. */
  static commit<T>(enable = true) {
    return new DefinitionContextBuilder<T>({}).commit(enable);
  }
}
