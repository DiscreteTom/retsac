import { Callback, Condition } from "../model";
import {
  DefinitionContext,
  TempPartialConflict,
  ConflictType,
  Definition,
  Reducer,
} from "./model";
import { defToTempGRs } from "./utils/definition";

export type RR_ResolverOptions<T> = {
  reduce?: boolean | Condition<T>;
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
  private _rejecter: Condition<T>;
  private resolved: TempPartialConflict<T>[];
  private _rollback: Callback<T>;
  private _commit: Condition<T>;

  constructor(data?: {
    callback?: Callback<T>;
    rejecter?: Condition<T>;
    resolved?: TempPartialConflict<T>[];
    rollback?: Callback<T>;
  }) {
    this._callback = data?.callback ?? (() => {});
    this._rejecter = data?.rejecter ?? (() => false);
    this.resolved = data?.resolved ?? [];
    this._rollback = data?.rollback ?? (() => {});
    this._commit = () => false;
  }

  /** Modify this context with the new callback appended. */
  callback(f: Callback<T>) {
    const _callback = this._callback;
    this._callback = (ctx) => {
      _callback(ctx);
      f(ctx);
    };

    return this;
  }

  /** Modify this context with the new rejecter appended. */
  rejecter(f: Condition<T>) {
    const _rejecter = this._rejecter;
    this._rejecter = (ctx) => {
      return _rejecter(ctx) || f(ctx);
    };

    return this;
  }

  /** Modify this context with a reducer appended which can reduce data. */
  reducer(f: Reducer<T>) {
    return this.callback(
      (context) =>
        (context.data = f(
          context.matched.map((node) => node.data),
          context
        ))
    );
  }

  /** Modify this context with a rollback function appended. */
  rollback(f: Callback<T>) {
    const _rollback = this._rollback;
    this._rollback = (ctx) => {
      _rollback(ctx);
      f(ctx);
    };

    return this;
  }

  commit(enable: boolean | Condition<T> = true) {
    this._commit = typeof enable === "boolean" ? () => enable : enable;
    return this;
  }

  private resolve(
    type: ConflictType,
    another: Definition,
    next: string,
    reduce: boolean | Condition<T>,
    handleEnd: boolean
  ) {
    const anotherRule = defToTempGRs<T>(another)[0];
    // TODO: use a dedicated lexer to parse next
    const nextGrammars =
      next.length > 0 ? defToTempGRs<T>({ "": next })[0].rule : [];

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

  /** Resolve an Reduce-Shift conflict. */
  resolveRS(
    another: Definition,
    options: {
      next: string;
      reduce?: boolean | Condition<T>;
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
  resolveRR(another: Definition, options: RR_ResolverOptions<T>) {
    return this.resolve(
      ConflictType.REDUCE_REDUCE,
      another,
      options.next ?? "",
      options.reduce ?? true,
      options.handleEnd ?? false
    );
  }

  build(): DefinitionContext<T> {
    return {
      callback: this._callback,
      rejecter: this._rejecter,
      resolved: this.resolved,
      rollback: this._rollback,
      commit: this._commit,
    };
  }

  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-S conflict.
   */
  static resolveRS<T>(
    another: Definition,
    options: {
      next: string;
      reduce?: boolean | Condition<T>;
    }
  ) {
    return new DefinitionContextBuilder<T>({}).resolveRS(another, options);
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<T>(another: Definition, options: RR_ResolverOptions<T>) {
    return new DefinitionContextBuilder<T>({}).resolveRR(another, options);
  }
  /** Create a new DefinitionContextBuilder with the new callback appended. */
  static callback<T>(f: Callback<T>) {
    return new DefinitionContextBuilder<T>({}).callback(f);
  }
  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  static rejecter<T>(f: Condition<T>) {
    return new DefinitionContextBuilder<T>({}).rejecter(f);
  }
  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  static reducer<T>(f: Reducer<T>) {
    return new DefinitionContextBuilder<T>({}).reducer(f);
  }
  /** Create a new DefinitionContextBuilder with the new rollback function appended. */
  static rollback<T>(f: Callback<T>) {
    return new DefinitionContextBuilder<T>({}).rollback(f);
  }
  /** Create a new DefinitionContextBuilder which will call `parser.commit` if the grammar rule is accepted. */
  static commit<T>(enable: boolean | Condition<T> = true) {
    return new DefinitionContextBuilder<T>({}).commit(enable);
  }
}
