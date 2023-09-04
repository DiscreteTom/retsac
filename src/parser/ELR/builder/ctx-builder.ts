import { Traverser } from "../../ast";
import { Callback, Condition, ConflictType, Reducer } from "../model";
import {
  DefinitionContext,
  Definition,
  ResolvedPartialTempConflict,
} from "./model";
import { RS_ResolverOptions, RR_ResolverOptions } from "./model";

export class DefinitionContextBuilder<T, Kinds extends string> {
  private resolved: ResolvedPartialTempConflict<T, Kinds>[];
  private _callback?: Callback<T, Kinds>;
  private _rejecter?: Condition<T, Kinds>;
  private _rollback?: Callback<T, Kinds>;
  private _commit?: Condition<T, Kinds>;
  private _traverser?: Traverser<T, Kinds>;

  constructor() {
    this.resolved = [];
  }

  /**
   * Modify this context with the new callback appended.
   */
  callback(f: Callback<T, Kinds>) {
    const _callback = this._callback;
    this._callback =
      _callback == undefined
        ? f
        : (ctx) => {
            _callback(ctx);
            f(ctx);
          };

    return this;
  }

  /**
   * Modify this context with the new rejecter appended.
   */
  rejecter(f: Condition<T, Kinds>) {
    const _rejecter = this._rejecter;
    this._rejecter =
      _rejecter == undefined
        ? f
        : (ctx) => {
            return _rejecter(ctx) || f(ctx);
          };

    return this;
  }

  /**
   * Modify this context with a reducer appended which can reduce data.
   */
  reducer(f: Reducer<T, Kinds>) {
    return this.callback((context) => (context.data = f(context)));
  }

  /**
   *  Modify this context with a rollback function appended.
   */
  rollback(f: Callback<T, Kinds>) {
    const _rollback = this._rollback;
    this._rollback =
      _rollback == undefined
        ? f
        : (ctx) => {
            _rollback(ctx);
            f(ctx);
          };

    return this;
  }

  /**
   * Set the traverser for this grammar rule.
   */
  traverser(f: Traverser<T, Kinds>) {
    this._traverser = f;
    return this;
  }

  /**
   * If `true` or returns `true`, the parser will commit the current state when the grammar rule is accepted.
   */
  commit(enable: boolean | Condition<T, Kinds> = true) {
    this._commit = typeof enable === "boolean" ? () => enable : enable;
    return this;
  }

  /**
   * Resolve an Reduce-Shift conflict.
   */
  resolveRS(another: Definition<Kinds>, options: RS_ResolverOptions<T, Kinds>) {
    this.resolved.push({
      type: ConflictType.REDUCE_SHIFT,
      anotherRule: another,
      options,
    });
    return this;
  }

  /**
   * Resolve an Reduce-Reduce conflict.
   */
  resolveRR(another: Definition<Kinds>, options: RR_ResolverOptions<T, Kinds>) {
    this.resolved.push({
      type: ConflictType.REDUCE_REDUCE,
      anotherRule: another,
      options,
    });
    return this;
  }

  build(): DefinitionContext<T, Kinds> {
    return {
      resolved: this.resolved,
      callback: this._callback,
      rejecter: this._rejecter,
      rollback: this._rollback,
      commit: this._commit,
      traverser: this._traverser,
    };
  }

  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-S conflict.
   */
  static resolveRS<T, Kinds extends string>(
    another: Definition<Kinds>,
    options: RS_ResolverOptions<T, Kinds>
  ) {
    return new DefinitionContextBuilder<T, Kinds>().resolveRS(another, options);
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<T, Kinds extends string>(
    another: Definition<Kinds>,
    options: RR_ResolverOptions<T, Kinds>
  ) {
    return new DefinitionContextBuilder<T, Kinds>().resolveRR(another, options);
  }
  /** Create a new DefinitionContextBuilder with the new callback appended. */
  static callback<T, Kinds extends string>(f: Callback<T, Kinds>) {
    return new DefinitionContextBuilder<T, Kinds>().callback(f);
  }
  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  static rejecter<T, Kinds extends string>(f: Condition<T, Kinds>) {
    return new DefinitionContextBuilder<T, Kinds>().rejecter(f);
  }
  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  static reducer<T, Kinds extends string>(f: Reducer<T, Kinds>) {
    return new DefinitionContextBuilder<T, Kinds>().reducer(f);
  }
  /** Create a new DefinitionContextBuilder with the new rollback function appended. */
  static rollback<T, Kinds extends string>(f: Callback<T, Kinds>) {
    return new DefinitionContextBuilder<T, Kinds>().rollback(f);
  }
  /** Create a new DefinitionContextBuilder which will call `parser.commit` if the grammar rule is accepted. */
  static commit<T, Kinds extends string>(
    enable: boolean | Condition<T, Kinds> = true
  ) {
    return new DefinitionContextBuilder<T, Kinds>().commit(enable);
  }
  /** Create a new DefinitionContextBuilder with the traverser set. */
  static traverser<T, Kinds extends string>(f: Traverser<T, Kinds>) {
    return new DefinitionContextBuilder<T, Kinds>().traverser(f);
  }
}
