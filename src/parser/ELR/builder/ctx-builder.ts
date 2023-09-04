import { Traverser } from "../../ast";
import { Callback, Condition, ConflictType, Reducer } from "../model";
import {
  DefinitionContext,
  Definition,
  ResolvedPartialTempConflict,
} from "./model";
import { RS_ResolverOptions, RR_ResolverOptions } from "./model";

export class DefinitionContextBuilder<ASTData, Kinds extends string> {
  private resolved: ResolvedPartialTempConflict<ASTData, Kinds>[];
  private _callback?: Callback<ASTData, Kinds>;
  private _rejecter?: Condition<ASTData, Kinds>;
  private _rollback?: Callback<ASTData, Kinds>;
  private _commit?: Condition<ASTData, Kinds>;
  private _traverser?: Traverser<ASTData, Kinds>;

  constructor() {
    this.resolved = [];
  }

  /**
   * Modify this context with the new callback appended.
   */
  callback(f: Callback<ASTData, Kinds>) {
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
  rejecter(f: Condition<ASTData, Kinds>) {
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
  reducer(f: Reducer<ASTData, Kinds>) {
    return this.callback((context) => (context.data = f(context)));
  }

  /**
   *  Modify this context with a rollback function appended.
   */
  rollback(f: Callback<ASTData, Kinds>) {
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
  traverser(f: Traverser<ASTData, Kinds>) {
    this._traverser = f;
    return this;
  }

  /**
   * If `true` or returns `true`, the parser will commit the current state when the grammar rule is accepted.
   */
  commit(enable: boolean | Condition<ASTData, Kinds> = true) {
    this._commit = typeof enable === "boolean" ? () => enable : enable;
    return this;
  }

  /**
   * Resolve an Reduce-Shift conflict.
   */
  resolveRS(
    another: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, Kinds>
  ) {
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
  resolveRR(
    another: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, Kinds>
  ) {
    this.resolved.push({
      type: ConflictType.REDUCE_REDUCE,
      anotherRule: another,
      options,
    });
    return this;
  }

  build(): DefinitionContext<ASTData, Kinds> {
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
  static resolveRS<ASTData, Kinds extends string>(
    another: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, Kinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds>().resolveRS(
      another,
      options
    );
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<ASTData, Kinds extends string>(
    another: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, Kinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds>().resolveRR(
      another,
      options
    );
  }
  /** Create a new DefinitionContextBuilder with the new callback appended. */
  static callback<ASTData, Kinds extends string>(f: Callback<ASTData, Kinds>) {
    return new DefinitionContextBuilder<ASTData, Kinds>().callback(f);
  }
  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  static rejecter<ASTData, Kinds extends string>(f: Condition<ASTData, Kinds>) {
    return new DefinitionContextBuilder<ASTData, Kinds>().rejecter(f);
  }
  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  static reducer<ASTData, Kinds extends string>(f: Reducer<ASTData, Kinds>) {
    return new DefinitionContextBuilder<ASTData, Kinds>().reducer(f);
  }
  /** Create a new DefinitionContextBuilder with the new rollback function appended. */
  static rollback<ASTData, Kinds extends string>(f: Callback<ASTData, Kinds>) {
    return new DefinitionContextBuilder<ASTData, Kinds>().rollback(f);
  }
  /** Create a new DefinitionContextBuilder which will call `parser.commit` if the grammar rule is accepted. */
  static commit<ASTData, Kinds extends string>(
    enable: boolean | Condition<ASTData, Kinds> = true
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds>().commit(enable);
  }
  /** Create a new DefinitionContextBuilder with the traverser set. */
  static traverser<ASTData, Kinds extends string>(
    f: Traverser<ASTData, Kinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds>().traverser(f);
  }
}
