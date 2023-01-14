import {
  Accepter,
  BaseDefinitionContextBuilder,
  Callback,
  Rejecter,
  TempPartialConflict,
  ConflictType,
  Definition,
  DefinitionContext,
  RR_ResolverOptions,
} from "../../base";
import { defToTempGRs } from "../../base/builder/utils/definition";
import { ParserContext } from "../model";

export class DefinitionContextBuilder<T> extends BaseDefinitionContextBuilder<
  T,
  string,
  ParserContext<T>
> {
  constructor(data: {
    callback?: Callback<T, string, ParserContext<T>>;
    rejecter?: Rejecter<T, string, ParserContext<T>>;
    resolved?: TempPartialConflict<T, string, ParserContext<T>>[];
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
    reduce: boolean | Accepter<T, string, ParserContext<T>>,
    handleEnd: boolean
  ) {
    const anotherRule = defToTempGRs<T, string, ParserContext<T>>(another)[0];
    // TODO: use a dedicated lexer to parse next
    const nextGrammars =
      next.length > 0
        ? defToTempGRs<T, string, ParserContext<T>>({ "": next })[0].rule
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
        // check if any next grammar match the next token
        if (
          nextGrammars.some(
            (g) =>
              ctx.lexer
                .clone() // clone the lexer to avoid changing the original lexer
                .lex({
                  expect: {
                    types: [g.toGrammar().toASTNode(ctx.lexer).type],
                    text: g.toGrammar().toASTNode(ctx.lexer).text,
                  },
                }) != null
          )
        )
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
    options: {
      next: string;
      reduce?: boolean | Accepter<T, string, ParserContext<T>>;
    }
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
    options: RR_ResolverOptions<T, string, ParserContext<T>>
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
    reduce: boolean | Accepter<T, string, ParserContext<T>>,
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
    options: {
      next: string;
      reduce?: boolean | Accepter<T, string, ParserContext<T>>;
    }
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
  resolveRR(
    another: Definition,
    options: RR_ResolverOptions<T, string, ParserContext<T>>
  ) {
    return this.resolve(
      ConflictType.REDUCE_REDUCE,
      another,
      options.next ?? "",
      options.reduce ?? true,
      options.handleEnd ?? false
    );
  }
}
