import { Callback, BaseParserContext, Rejecter } from "../model";
import {
  DefinitionContext,
  Accepter,
  TempPartialConflict,
  ConflictType,
  Definition,
} from "./model";

export type RR_ResolverOptions<
  T,
  After,
  Ctx extends BaseParserContext<T, After>
> = {
  reduce?: boolean | Accepter<T, After, Ctx>;
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

export abstract class BaseDefinitionContextBuilder<
  T,
  After,
  Ctx extends BaseParserContext<T, After>
> {
  protected _callback: Callback<T, After, Ctx>;
  protected _rejecter: Rejecter<T, After, Ctx>;
  protected resolved: TempPartialConflict<T, After, Ctx>[];
  protected undo: Callback<T, After, Ctx>;

  constructor(data?: {
    callback?: Callback<T, After, Ctx>;
    rejecter?: Rejecter<T, After, Ctx>;
    resolved?: TempPartialConflict<T, After, Ctx>[];
    rollback?: Callback<T, After, Ctx>;
  }) {
    this._callback = data?.callback ?? (() => {});
    this._rejecter = data?.rejecter ?? (() => false);
    this.resolved = data?.resolved ?? [];
    this.undo = data?.rollback ?? (() => {});
  }

  /** Modify this context with the new callback appended. */
  callback(f: Callback<T, After, Ctx>) {
    const _callback = this._callback;
    this._callback = (ctx) => {
      _callback(ctx);
      f(ctx);
    };

    return this;
  }

  /** Modify this context with the new rejecter appended. */
  rejecter(f: Rejecter<T, After, Ctx>) {
    const _rejecter = this._rejecter;
    this._rejecter = (ctx) => {
      return _rejecter(ctx) || f(ctx);
    };

    return this;
  }

  /** Modify this context with a reducer appended which can reduce data. */
  reducer(f: (data: (T | undefined)[], context: Ctx) => T | undefined) {
    return this.callback(
      (context) =>
        (context.data = f(
          context.matched.map((node) => node.data),
          context
        ))
    );
  }

  /** Modify this context with a rollback function appended. */
  rollback(f: Callback<T, After, Ctx>) {
    const undo = this.undo;
    this.undo = (ctx) => {
      undo(ctx);
      f(ctx);
    };

    return this;
  }

  /** Resolve a RS/RR conflict. */
  protected abstract resolve(
    type: ConflictType,
    another: Definition,
    next: string,
    reduce: boolean | Accepter<T, After, Ctx>,
    handleEnd: boolean
  ): this;

  /** Resolve an Reduce-Shift conflict. */
  resolveRS(
    another: Definition,
    options: {
      next: string;
      reduce?: boolean | Accepter<T, After, Ctx>;
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

  /** Resolve an Reduce-Reduce conflict. */
  resolveRR(another: Definition, options: RR_ResolverOptions<T, After, Ctx>) {
    return this.resolve(
      ConflictType.REDUCE_REDUCE,
      another,
      options.next ?? "",
      options.reduce ?? true,
      options.handleEnd ?? false
    );
  }

  build(): DefinitionContext<T, After, Ctx> {
    return {
      callback: this._callback,
      rejecter: this._rejecter,
      resolved: this.resolved,
      rollback: this.undo,
    };
  }
}
