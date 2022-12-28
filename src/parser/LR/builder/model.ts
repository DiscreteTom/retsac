import { Callback, Rejecter } from "../model";
import { TempGrammar, TempGrammarRule, TempGrammarType } from "./grammar";
import { defToTempGRs } from "./utils";

export interface Definition {
  [NT: string]: string | string[];
}

export class DefinitionContextBuilder<T> {
  private _callback: Callback<T>;
  private _rejecter: Rejecter<T>;
  private resolved: PartialResolvedConflict<T>[];

  constructor(data: {
    callback?: Callback<T>;
    rejecter?: Rejecter<T>;
    resolved?: PartialResolvedConflict<T>[];
  }) {
    this._callback = data.callback ?? (() => {});
    this._rejecter = data.rejecter ?? (() => false);
    this.resolved = data.resolved ?? [];
  }

  /** Create a new DefinitionContext with a callback. */
  static callback<T>(f: Callback<T>) {
    return new DefinitionContextBuilder<T>({ callback: f });
  }
  /** Create a new DefinitionContextBuilder with a rejecter. */
  static rejecter<T>(f: Rejecter<T>) {
    return new DefinitionContextBuilder<T>({ rejecter: f });
  }

  /** Create a new DefinitionContextBuilder with the new callback appended. */
  callback(f: Callback<T>) {
    return new DefinitionContextBuilder<T>({
      callback: (ctx) => {
        this._callback(ctx);
        f(ctx);
      },
      rejecter: this._rejecter,
      resolved: this.resolved,
    });
  }

  /** Create a new DefinitionContextBuilder with the new rejecter appended. */
  rejecter(f: Rejecter<T>) {
    return new DefinitionContextBuilder<T>({
      callback: this._callback,
      rejecter: (ctx) => {
        return this._rejecter(ctx) || f(ctx);
      },
      resolved: this.resolved,
    });
  }

  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the specified type conflict.
   */
  private static resolve<T>(
    type: ConflictType,
    another: Definition,
    next: string,
    reject: boolean,
    end: boolean
  ) {
    const anotherGr = defToTempGRs<T>(another)[0];
    const nextGrammars = defToTempGRs<T>({ "": next })[0].rule;

    return new DefinitionContextBuilder<T>({
      rejecter: (ctx) => {
        // if reach end of input
        if (ctx.after.length == 0) {
          // if handle the end of input
          if (end) return reject;
          else return false;
        }
        // else, not the end of input
        // check if any next grammar match the after[0]
        if (
          nextGrammars.some(
            (g) =>
              (g.type == TempGrammarType.LITERAL &&
                g.content == ctx.after[0].text) ||
              (g.type == TempGrammarType.GRAMMAR &&
                g.content == ctx.after[0].type)
          )
        )
          return reject;
        return false;
      },
      resolved: [
        {
          type,
          another: anotherGr,
          next: nextGrammars,
          reject,
          end,
        },
      ],
    });
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-S conflict.
   */
  static resolveRS<T>(
    another: Definition,
    { reject = true, end = false, next = "" }
  ) {
    return this.resolve<T>(
      ConflictType.REDUCE_SHIFT,
      another,
      next,
      reject,
      end
    );
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<T>(
    another: Definition,
    { reject = true, end = false, next = "" }
  ) {
    return this.resolve<T>(
      ConflictType.REDUCE_REDUCE,
      another,
      next,
      reject,
      end
    );
  }
  resolveRS(another: Definition, { reject = true, end = false, next = "" }) {
    // TODO
  }
  resolveRR(another: Definition, { reject = true, end = false, next = "" }) {
    // TODO
  }

  static reducer() {
    // TODO
  }
  reducer() {
    // TODO
  }

  build(gr: TempGrammarRule<T>) {
    // TODO
  }
}

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

/** Conflict without reducer. */
export interface PartialConflict<T> {
  type: ConflictType;
  /** If this is a R-S conflict, this rule is a shifter. If this is a R-R conflict, this rule is a reducer. */
  another: TempGrammarRule<T>;
  next: TempGrammar[];
  /** Whether to handle conflict if reach the end of input */
  end: boolean;
}

/** ResolvedConflict without reducer. */
export interface PartialResolvedConflict<T> extends PartialConflict<T> {
  reject: boolean;
}

export interface Conflict<T> extends PartialConflict<T> {
  reducer: TempGrammarRule<T>;
}

export interface ResolvedConflict<T> extends Conflict<T> {
  reject: boolean;
}
