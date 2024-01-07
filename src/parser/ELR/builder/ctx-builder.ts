import type { GeneralTokenDataBinding, Token } from "../../../lexer";
import type { NTNodeTraverser } from "../../traverser";
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
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> {
  private resolved: ResolvedPartialTempConflict<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >[];
  private _callback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  private _rejecter?: Condition<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  private _rollback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  private _commit?: Condition<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  private _traverser?: NTNodeTraverser<
    NTs,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>,
    Global
  >;

  constructor() {
    this.resolved = [];
  }

  /**
   * Modify this context with the new callback appended.
   */
  callback(
    f: Callback<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ) {
    const _callback = this._callback;
    this._callback =
      _callback === undefined
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
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ) {
    const _rejecter = this._rejecter;
    this._rejecter =
      _rejecter === undefined
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
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ) {
    return this.callback((context) => (context.data = f(context)));
  }

  /**
   *  Modify this context with a rollback function appended.
   */
  // TODO: remove this?
  rollback(
    f: Callback<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ) {
    const _rollback = this._rollback;
    this._rollback =
      _rollback === undefined
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
  traverser(
    f: NTNodeTraverser<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>,
      Global
    >,
  ) {
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
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        > = true,
  ) {
    this._commit = typeof enable === "boolean" ? () => enable : enable;
    return this;
  }

  /**
   * Resolve an Reduce-Shift conflict.
   */
  resolveRS(
    another: Definition<NTs>,
    options: RS_ResolverOptions<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
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
    another: Definition<NTs>,
    options: RR_ResolverOptions<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
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
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
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
}

export type DefinitionContextBuilderDecorator<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> = (
  ctxBuilder: DefinitionContextBuilder<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
) => DefinitionContextBuilder<
  NTs,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType,
  Global
>;
