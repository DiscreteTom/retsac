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

export class DefinitionContextBuilder<T> extends BaseDefinitionContextBuilder<
  T,
  ASTNode<T>[]
> {
  constructor(data: {
    callback?: Callback<T, ASTNode<T>[]>;
    rejecter?: Rejecter<T, ASTNode<T>[]>;
    resolved?: TempPartialConflict<T, ASTNode<T>[]>[];
  }) {
    super(data);
  }

  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the specified type conflict.
   */
  private static resolve<T>(
    type: ConflictType,
    another: Definition,
    next: string,
    reduce: boolean | Accepter<T, ASTNode<T>[]>,
    handleEnd: boolean
  ) {
    const anotherRule = defToTempGRs<T, ASTNode<T>[]>(another)[0];
    // TODO: use a dedicated lexer to parse next
    const nextGrammars =
      next.length > 0
        ? defToTempGRs<T, ASTNode<T>[]>({ "": next })[0].rule
        : [];

    return new DefinitionContextBuilder<T>({
      rejecter: (ctx) => {
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
      },
      resolved: [
        {
          type,
          anotherRule,
          next: nextGrammars,
          handleEnd: handleEnd,
        },
      ],
    });
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-S conflict.
   */
  static resolveRS<T>(
    another: Definition,
    options: { next: string; reduce?: boolean | Accepter<T, ASTNode<T>[]> }
  ) {
    return DefinitionContextBuilder.resolve<T>(
      ConflictType.REDUCE_SHIFT,
      another,
      options.next,
      options.reduce ?? true,
      false
    );
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<T>(
    another: Definition,
    options: RR_ResolverOptions<T, ASTNode<T>[]>
  ) {
    return DefinitionContextBuilder.resolve<T>(
      ConflictType.REDUCE_REDUCE,
      another,
      options.next ?? "",
      options.reduce ?? true,
      options.handleEnd ?? false
    );
  }
  /** Create a new DefinitionContextBuilder with the new specified type resolved conflict appended. */
  private resolve(
    type: ConflictType,
    another: Definition,
    next: string,
    reduce: boolean | Accepter<T, ASTNode<T>[]>,
    handleEnd: boolean
  ) {
    const anotherCtx = DefinitionContextBuilder.resolve<T>(
      type,
      another,
      next,
      reduce,
      handleEnd
    );
    return new DefinitionContextBuilder<T>({
      callback: this._callback,
      rejecter: (ctx) => {
        return this._rejecter(ctx) || anotherCtx._rejecter(ctx);
      },
      resolved: this.resolved.concat(anotherCtx.resolved),
    });
  }
  /** Create a new DefinitionContextBuilder with the new resolved R-S conflict appended. */
  resolveRS(
    another: Definition,
    options: { next: string; reduce?: boolean | Accepter<T, ASTNode<T>[]> }
  ) {
    return this.resolve(
      ConflictType.REDUCE_SHIFT,
      another,
      options.next,
      options.reduce ?? true,
      false
    );
  }
  /** Create a new DefinitionContextBuilder with the new resolved R-R conflict appended. */
  resolveRR(another: Definition, options: RR_ResolverOptions<T, ASTNode<T>[]>) {
    return this.resolve(
      ConflictType.REDUCE_REDUCE,
      another,
      options.next ?? "",
      options.reduce ?? true,
      options.handleEnd ?? false
    );
  }
}
