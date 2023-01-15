import { Callback, BaseParserContext, Rejecter } from "../model";
import { DefinitionContext, Accepter, TempPartialConflict } from "./model";

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

export class BaseDefinitionContextBuilder<
  T,
  After,
  Ctx extends BaseParserContext<T, After>
> {
  protected _callback: Callback<T, After, Ctx>;
  protected _rejecter: Rejecter<T, After, Ctx>;
  protected resolved: TempPartialConflict<T, After, Ctx>[];

  constructor(data: {
    callback?: Callback<T, After, Ctx>;
    rejecter?: Rejecter<T, After, Ctx>;
    resolved?: TempPartialConflict<T, After, Ctx>[];
  }) {
    this._callback = data.callback ?? (() => {});
    this._rejecter = data.rejecter ?? (() => false);
    this.resolved = data.resolved ?? [];
  }

  /** Create a new DefinitionContextBuilder with the new callback appended. */
  callback(f: Callback<T, After, Ctx>) {
    const _callback = this._callback;
    this._callback = (ctx) => {
      _callback(ctx);
      f(ctx);
    };

    return this;
  }

  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  rejecter(f: Rejecter<T, After, Ctx>) {
    const _rejecter = this._rejecter;
    this._rejecter = (ctx) => {
      return _rejecter(ctx) || f(ctx);
    };

    return this;
  }

  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  reducer(f: (data: (T | undefined)[], context: Ctx) => T | undefined) {
    return this.callback(
      (context) =>
        (context.data = f(
          context.matched.map((node) => node.data),
          context
        ))
    );
  }

  build(): DefinitionContext<T, After, Ctx> {
    return {
      callback: this._callback,
      rejecter: this._rejecter,
      resolved: this.resolved,
    };
  }
}
