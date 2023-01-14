import { Callback, BaseParserContext, Rejecter } from "../model";
import { DefinitionContext, Accepter, TempPartialConflict } from "./model";

export type RR_ResolverOptions<T, After> = {
  reduce?: boolean | Accepter<T, After>;
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

export class BaseDefinitionContextBuilder<T, After> {
  protected _callback: Callback<T, After>;
  protected _rejecter: Rejecter<T, After>;
  protected resolved: TempPartialConflict<T, After>[];

  constructor(data: {
    callback?: Callback<T, After>;
    rejecter?: Rejecter<T, After>;
    resolved?: TempPartialConflict<T, After>[];
  }) {
    this._callback = data.callback ?? (() => {});
    this._rejecter = data.rejecter ?? (() => false);
    this.resolved = data.resolved ?? [];
  }

  /** Create a new DefinitionContext with a callback. */
  static callback<T, After>(f: Callback<T, After>) {
    return new BaseDefinitionContextBuilder<T, After>({ callback: f });
  }
  /** Create a new DefinitionContextBuilder with a rejecter. */
  static rejecter<T, After>(f: Rejecter<T, After>) {
    return new BaseDefinitionContextBuilder<T, After>({ rejecter: f });
  }

  /** Create a new DefinitionContextBuilder with the new callback appended. */
  callback(f: Callback<T, After>) {
    return new BaseDefinitionContextBuilder<T, After>({
      callback: (ctx) => {
        this._callback(ctx);
        f(ctx);
      },
      rejecter: this._rejecter,
      resolved: this.resolved,
    });
  }

  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  rejecter(f: Rejecter<T, After>) {
    return new BaseDefinitionContextBuilder<T, After>({
      callback: this._callback,
      rejecter: (ctx) => {
        return this._rejecter(ctx) || f(ctx);
      },
      resolved: this.resolved,
    });
  }

  /** Create a new DefinitionContextBuilder with a reducer which can reduce data. */
  static reducer<T, After>(
    f: (
      data: (T | undefined)[],
      context: BaseParserContext<T, After>
    ) => T | undefined
  ) {
    return BaseDefinitionContextBuilder.callback<T, After>(
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

  build(): DefinitionContext<T, After> {
    return {
      callback: this._callback,
      rejecter: this._rejecter,
      resolved: this.resolved,
    };
  }
}
