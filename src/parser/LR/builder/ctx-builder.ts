import { ASTNode } from "../../ast";
import {
  Accepter,
  Callback,
  Rejecter,
  TempPartialConflict,
  ConflictType,
  Definition,
  BaseDefinitionContextBuilder,
  RR_ResolverOptions,
} from "../../base";
import { defToTempGRs } from "../../base/builder/utils/definition";
import { ParserContext } from "../model";

export class DefinitionContextBuilder<T> extends BaseDefinitionContextBuilder<
  T,
  ASTNode<T>[],
  ParserContext<T>
> {
  constructor(data?: {
    callback?: Callback<T, ASTNode<T>[], ParserContext<T>>;
    rejecter?: Rejecter<T, ASTNode<T>[], ParserContext<T>>;
    resolved?: TempPartialConflict<T, ASTNode<T>[], ParserContext<T>>[];
  }) {
    super(data);
  }

  protected resolve(
    type: ConflictType,
    another: Definition,
    next: string,
    reduce: boolean | Accepter<T, ASTNode<T>[], ParserContext<T>>,
    handleEnd: boolean
  ) {
    const anotherRule = defToTempGRs<T, ASTNode<T>[], ParserContext<T>>(
      another
    )[0];
    // TODO: use a dedicated lexer to parse next
    const nextGrammars =
      next.length > 0
        ? defToTempGRs<T, ASTNode<T>[], ParserContext<T>>({ "": next })[0].rule
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
      reduce?: boolean | Accepter<T, ASTNode<T>[], ParserContext<T>>;
    }
  ) {
    return new DefinitionContextBuilder<T>({}).resolveRS(another, options);
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<T>(
    another: Definition,
    options: RR_ResolverOptions<T, ASTNode<T>[], ParserContext<T>>
  ) {
    return new DefinitionContextBuilder<T>({}).resolveRR(another, options);
  }
  static callback<T>(f: Callback<T, ASTNode<T>[], ParserContext<T>>) {
    return new DefinitionContextBuilder<T>({}).callback(f);
  }
  static rejecter<T>(f: Rejecter<T, ASTNode<T>[], ParserContext<T>>) {
    return new DefinitionContextBuilder<T>({}).rejecter(f);
  }
  static reducer<T>(
    f: (data: (T | undefined)[], context: ParserContext<T>) => T | undefined
  ) {
    return new DefinitionContextBuilder<T>({}).reducer(f);
  }
}
