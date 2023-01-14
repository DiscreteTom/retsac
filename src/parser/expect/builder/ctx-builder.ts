import { Callback, ParserContext, Rejecter } from "../model";
import {
  ConflictType,
  Definition,
  DefinitionContext,
  Accepter,
  TempPartialConflict,
} from "./model";
import { defToTempGRs } from "./utils/definition";

export type RR_ResolverOptions<T> = {
  reduce?: boolean | Accepter<T>;
} & (
  | {
      next: string;
      handleEnd?: boolean;
    }
  | {
      next?: string;
      handleEnd: boolean;
    }
);

export class DefinitionContextBuilder<T> {
  private _callback: Callback<T>;
  private _rejecter: Rejecter<T>;
  private resolved: TempPartialConflict<T>[];

  constructor(data: {
    callback?: Callback<T>;
    rejecter?: Rejecter<T>;
    resolved?: TempPartialConflict<T>[];
  }) {
    this._callback = data.callback ?? (() => {});
    this._rejecter = data.rejecter ?? (() => false);
    this.resolved = data.resolved ?? [];
  }

  /** Create a new DefinitionContext with a callback. */
  static callback<T>(f: Callback<T>) {
    return new DefinitionContextBuilder<T>({ callback: f });
  }
  /** Create a new DefinitionContextBuilder with a rejecter. */
  static rejecter<T>(f: Rejecter<T>) {
    return new DefinitionContextBuilder<T>({ rejecter: f });
  }

  /** Create a new DefinitionContextBuilder with the new callback appended. */
  callback(f: Callback<T>) {
    return new DefinitionContextBuilder<T>({
      callback: (ctx) => {
        this._callback(ctx);
        f(ctx);
      },
      rejecter: this._rejecter,
      resolved: this.resolved,
    });
  }

  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  rejecter(f: Rejecter<T>) {
    return new DefinitionContextBuilder<T>({
      callback: this._callback,
      rejecter: (ctx) => {
        return this._rejecter(ctx) || f(ctx);
      },
      resolved: this.resolved,
    });
  }

  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the specified type conflict.
   */
  private static resolve<T>(
    type: ConflictType,
    another: Definition,
    next: string,
    reduce: boolean | Accepter<T>,
    handleEnd: boolean
  ) {
    const anotherRule = defToTempGRs<T>(another)[0];
    // TODO: use a dedicated lexer to parse next
    const nextGrammars =
      next.length > 0 ? defToTempGRs<T>({ "": next })[0].rule : [];

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
                    types: [g.toGrammar().toASTNode().type],
                    text: g.toGrammar().toASTNode().text,
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
    options: { next: string; reduce?: boolean | Accepter<T> }
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
  static resolveRR<T>(another: Definition, options: RR_ResolverOptions<T>) {
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
    reduce: boolean | Accepter<T>,
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
    options: { next: string; reduce?: boolean | Accepter<T> }
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
  resolveRR(another: Definition, options: RR_ResolverOptions<T>) {
    return this.resolve(
      ConflictType.REDUCE_REDUCE,
      another,
      options.next ?? "",
      options.reduce ?? true,
      options.handleEnd ?? false
    );
  }

  /** Create a new DefinitionContextBuilder with a reducer which can reduce data. */
  static reducer<T>(
    f: (data: (T | undefined)[], context: ParserContext<T>) => T | undefined
  ) {
    return DefinitionContextBuilder.callback<T>(
      (context) =>
        (context.data = f(
          context.matched.map((node) => node.data),
          context
        ))
    );
  }
  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  reducer(
    f: (data: (T | undefined)[], context: ParserContext<T>) => T | undefined
  ) {
    const anotherCtx = DefinitionContextBuilder.reducer(f);
    return this.callback(anotherCtx._callback);
  }

  build(): DefinitionContext<T> {
    return {
      callback: this._callback,
      rejecter: this._rejecter,
      resolved: this.resolved,
    };
  }
}