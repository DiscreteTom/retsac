import { ASTNode } from "../../ast";
import {
  ConflictType,
  Definition,
  BaseDefinitionContextBuilder,
  RR_ResolverOptions,
  Reducer,
} from "../../base";
import { defToTempGRs } from "../../base/builder/utils/definition";
import { LRCallback, LRParserContext, LRRejecter } from "../model";
import { LRAccepter, LRTempPartialConflict } from "./model";

export class DefinitionContextBuilder<T> extends BaseDefinitionContextBuilder<
  T,
  ASTNode<T>[],
  LRParserContext<T>
> {
  constructor(data?: {
    callback?: LRCallback<T>;
    rejecter?: LRRejecter<T>;
    resolved?: LRTempPartialConflict<T>[];
  }) {
    super(data);
  }

  protected resolve(
    type: ConflictType,
    another: Definition,
    next: string,
    reduce: boolean | LRAccepter<T>,
    handleEnd: boolean
  ) {
    const anotherRule = defToTempGRs<T, ASTNode<T>[], LRParserContext<T>>(
      another
    )[0];
    // TODO: use a dedicated lexer to parse next
    const nextGrammars =
      next.length > 0
        ? defToTempGRs<T, ASTNode<T>[], LRParserContext<T>>({ "": next })[0]
            .rule
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
      // check if any next grammar match the after[0]
      if (nextGrammars.some((g) => g.eq(ctx.after[0])))
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
      reduce?: boolean | LRAccepter<T>;
    }
  ) {
    return new DefinitionContextBuilder<T>({}).resolveRS(another, options);
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<T>(
    another: Definition,
    options: RR_ResolverOptions<T, ASTNode<T>[], LRParserContext<T>>
  ) {
    return new DefinitionContextBuilder<T>({}).resolveRR(another, options);
  }
  /** Create a new DefinitionContextBuilder with the new callback appended. */
  static callback<T>(f: LRCallback<T>) {
    return new DefinitionContextBuilder<T>({}).callback(f);
  }
  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  static rejecter<T>(f: LRRejecter<T>) {
    return new DefinitionContextBuilder<T>({}).rejecter(f);
  }
  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  static reducer<T>(f: Reducer<T, LRParserContext<T>>) {
    return new DefinitionContextBuilder<T>({}).reducer(f);
  }
}
