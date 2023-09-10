import { Traverser } from "../../ast";
import {
  Callback,
  Condition,
  ConflictType,
  Reducer,
  ResolverHydrationType,
} from "../model";
import {
  DefinitionContext,
  Definition,
  ResolvedPartialTempConflict,
  RS_ResolverOptions,
  RR_ResolverOptions,
} from "./model";

export class DefinitionContextBuilder<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> {
  private resolved: ResolvedPartialTempConflict<ASTData, Kinds, LexerKinds>[];
  private _callback?: Callback<ASTData, Kinds, LexerKinds>;
  private _rejecter?: Condition<ASTData, Kinds, LexerKinds>;
  private _rollback?: Callback<ASTData, Kinds, LexerKinds>;
  private _commit?: Condition<ASTData, Kinds, LexerKinds>;
  private _traverser?: Traverser<ASTData, Kinds | LexerKinds>;

  constructor() {
    this.resolved = [];
  }

  /**
   * Modify this context with the new callback appended.
   */
  callback(f: Callback<ASTData, Kinds, LexerKinds>) {
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
  rejecter(f: Condition<ASTData, Kinds, LexerKinds>) {
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
  reducer(f: Reducer<ASTData, Kinds, LexerKinds>) {
    return this.callback((context) => (context.data = f(context)));
  }

  /**
   *  Modify this context with a rollback function appended.
   */
  rollback(f: Callback<ASTData, Kinds, LexerKinds>) {
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
  traverser(f: Traverser<ASTData, Kinds | LexerKinds>) {
    this._traverser = f;
    return this;
  }

  /**
   * If `true` or returns `true`, the parser will commit the current state when the grammar rule is accepted.
   */
  commit(enable: boolean | Condition<ASTData, Kinds, LexerKinds> = true) {
    this._commit = typeof enable === "boolean" ? () => enable : enable;
    return this;
  }

  /**
   * Resolve an Reduce-Shift conflict.
   */
  resolveRS(
    another: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, Kinds, LexerKinds>
  ) {
    this.resolved.push({
      type: ConflictType.REDUCE_SHIFT,
      anotherRule: another,
      options,
      hydrationId: {
        type: ResolverHydrationType.CONTEXT,
        index: this.resolved.length,
      },
    });
    return this;
  }

  /**
   * Resolve an Reduce-Reduce conflict.
   */
  resolveRR(
    another: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, Kinds, LexerKinds>
  ) {
    this.resolved.push({
      type: ConflictType.REDUCE_REDUCE,
      anotherRule: another,
      options,
      hydrationId: {
        type: ResolverHydrationType.CONTEXT,
        index: this.resolved.length,
      },
    });
    return this;
  }

  build(): DefinitionContext<ASTData, Kinds, LexerKinds> {
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
  static resolveRS<ASTData, Kinds extends string, LexerKinds extends string>(
    another: Definition<Kinds>,
    options: RS_ResolverOptions<ASTData, Kinds, LexerKinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds, LexerKinds>().resolveRS(
      another,
      options
    );
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<ASTData, Kinds extends string, LexerKinds extends string>(
    another: Definition<Kinds>,
    options: RR_ResolverOptions<ASTData, Kinds, LexerKinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds, LexerKinds>().resolveRR(
      another,
      options
    );
  }
  /** Create a new DefinitionContextBuilder with the new callback appended. */
  static callback<ASTData, Kinds extends string, LexerKinds extends string>(
    f: Callback<ASTData, Kinds, LexerKinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds, LexerKinds>().callback(
      f
    );
  }
  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  static rejecter<ASTData, Kinds extends string, LexerKinds extends string>(
    f: Condition<ASTData, Kinds, LexerKinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds, LexerKinds>().rejecter(
      f
    );
  }
  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  static reducer<ASTData, Kinds extends string, LexerKinds extends string>(
    f: Reducer<ASTData, Kinds, LexerKinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds, LexerKinds>().reducer(
      f
    );
  }
  /** Create a new DefinitionContextBuilder with the new rollback function appended. */
  static rollback<ASTData, Kinds extends string, LexerKinds extends string>(
    f: Callback<ASTData, Kinds, LexerKinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds, LexerKinds>().rollback(
      f
    );
  }
  /** Create a new DefinitionContextBuilder which will call `parser.commit` if the grammar rule is accepted. */
  static commit<ASTData, Kinds extends string, LexerKinds extends string>(
    enable: boolean | Condition<ASTData, Kinds, LexerKinds> = true
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds, LexerKinds>().commit(
      enable
    );
  }
  /** Create a new DefinitionContextBuilder with the traverser set. */
  static traverser<ASTData, Kinds extends string, LexerKinds extends string>(
    f: Traverser<ASTData, Kinds | LexerKinds>
  ) {
    return new DefinitionContextBuilder<ASTData, Kinds, LexerKinds>().traverser(
      f
    );
  }
}
