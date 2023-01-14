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

  /** Create a new DefinitionContext with a callback. */
  static callback<T, After, Ctx extends BaseParserContext<T, After>>(
    f: Callback<T, After, Ctx>
  ) {
    return new BaseDefinitionContextBuilder<T, After, Ctx>({ callback: f });
  }
  /** Create a new DefinitionContextBuilder with a rejecter. */
  static rejecter<T, After, Ctx extends BaseParserContext<T, After>>(
    f: Rejecter<T, After, Ctx>
  ) {
    return new BaseDefinitionContextBuilder<T, After, Ctx>({ rejecter: f });
  }

  /** Create a new DefinitionContextBuilder with the new callback appended. */
  callback(f: Callback<T, After, Ctx>) {
    return new BaseDefinitionContextBuilder<T, After, Ctx>({
      callback: (ctx) => {
        this._callback(ctx);
        f(ctx);
      },
      rejecter: this._rejecter,
      resolved: this.resolved,
    });
  }

  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  rejecter(f: Rejecter<T, After, Ctx>) {
    return new BaseDefinitionContextBuilder<T, After, Ctx>({
      callback: this._callback,
      rejecter: (ctx) => {
        return this._rejecter(ctx) || f(ctx);
      },
      resolved: this.resolved,
    });
  }

  /** Create a new DefinitionContextBuilder with a reducer which can reduce data. */
  static reducer<T, After, Ctx extends BaseParserContext<T, After>>(
    f: (data: (T | undefined)[], context: Ctx) => T | undefined
  ) {
    return BaseDefinitionContextBuilder.callback<T, After, Ctx>(
      (context) =>
        (context.data = f(
          context.matched.map((node) => node.data),
          context
        ))
    );
  }
  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  reducer(
    f: (
      data: (T | undefined)[],
      context: BaseParserContext<T, After>
    ) => T | undefined
  ) {
    const anotherCtx = BaseDefinitionContextBuilder.reducer(f);
    return this.callback(anotherCtx._callback);
  }

  build(): DefinitionContext<T, After, Ctx> {
    return {
      callback: this._callback,
      rejecter: this._rejecter,
      resolved: this.resolved,
    };
  }
}
