import type { Traverser } from "../../traverser";
import type { Callback, Condition, Reducer } from "../model";
import { ConflictType, ResolverHydrationType } from "../model";
import type {
  DefinitionContext,
  Definition,
  ResolvedPartialTempConflict,
  RS_ResolverOptions,
  RR_ResolverOptions,
} from "./model";

export class DefinitionContextBuilder<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> {
  private resolved: ResolvedPartialTempConflict<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >[];
  private _callback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  private _rejecter?: Condition<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  private _rollback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  private _commit?: Condition<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  private _traverser?: Traverser<ASTData, ErrorType, Kinds | LexerKinds>;

  constructor() {
    this.resolved = [];
  }

  /**
   * Modify this context with the new callback appended.
   */
  callback(
    f: Callback<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
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
  rejecter(
    f: Condition<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
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
  reducer(
    f: Reducer<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
    return this.callback((context) => (context.data = f(context)));
  }

  /**
   *  Modify this context with a rollback function appended.
   */
  rollback(
    f: Callback<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
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
  traverser(f: Traverser<ASTData, ErrorType, Kinds | LexerKinds>) {
    this._traverser = f;
    return this;
  }

  /**
   * If `true` or returns `true`, the parser will commit the current state when the grammar rule is accepted.
   */
  commit(
    enable:
      | boolean
      | Condition<
          ASTData,
          ErrorType,
          Kinds,
          LexerKinds,
          LexerError,
          LexerActionState
        > = true,
  ) {
    this._commit = typeof enable === "boolean" ? () => enable : enable;
    return this;
  }

  /**
   * Resolve an Reduce-Shift conflict.
   */
  resolveRS(
    another: Definition<Kinds>,
    options: RS_ResolverOptions<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
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
    options: RR_ResolverOptions<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
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

  build(): DefinitionContext<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  > {
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
  static resolveRS<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    another: Definition<Kinds>,
    options: RS_ResolverOptions<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
    return new DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >().resolveRS(another, options);
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    another: Definition<Kinds>,
    options: RR_ResolverOptions<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
    return new DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >().resolveRR(another, options);
  }
  /** Create a new DefinitionContextBuilder with the new callback appended. */
  static callback<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    f: Callback<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
    return new DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >().callback(f);
  }
  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  static rejecter<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    f: Condition<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
    return new DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >().rejecter(f);
  }
  /** Create a new DefinitionContextBuilder with a reducer appended which can reduce data. */
  static reducer<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    f: Reducer<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
    return new DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >().reducer(f);
  }
  /** Create a new DefinitionContextBuilder with the new rollback function appended. */
  static rollback<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    f: Callback<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
  ) {
    return new DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >().rollback(f);
  }
  /** Create a new DefinitionContextBuilder which will call `parser.commit` if the grammar rule is accepted. */
  static commit<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    enable:
      | boolean
      | Condition<
          ASTData,
          ErrorType,
          Kinds,
          LexerKinds,
          LexerError,
          LexerActionState
        > = true,
  ) {
    return new DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >().commit(enable);
  }
  /** Create a new DefinitionContextBuilder with the traverser set. */
  static traverser<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(f: Traverser<ASTData, ErrorType, Kinds | LexerKinds>) {
    return new DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >().traverser(f);
  }

  /**
   * Reduce multi DefinitionContextBuilder into one.
   */
  static reduce<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    builders: DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >[],
  ) {
    const res = new DefinitionContextBuilder<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >();
    for (const b of builders) {
      res.resolved.push(...b.resolved);
      if (b._callback !== undefined) res.callback(b._callback);
      if (b._rejecter !== undefined) res.rejecter(b._rejecter);
      if (b._rollback !== undefined) res.rollback(b._rollback);
      if (b._commit !== undefined) res.commit(b._commit);
      if (b._traverser !== undefined) res.traverser(b._traverser);
    }
    return res;
  }
}
