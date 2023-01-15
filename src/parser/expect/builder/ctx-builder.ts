import {
  Accepter,
  BaseDefinitionContextBuilder,
  Callback,
  Rejecter,
  TempPartialConflict,
  ConflictType,
  Definition,
  RR_ResolverOptions,
} from "../../base";
import { defToTempGRs } from "../../base/builder/utils/definition";
import { ParserContext } from "../model";

export class DefinitionContextBuilder<T> extends BaseDefinitionContextBuilder<
  T,
  string,
  ParserContext<T>
> {
  constructor(data: {
    callback?: Callback<T, string, ParserContext<T>>;
    rejecter?: Rejecter<T, string, ParserContext<T>>;
    resolved?: TempPartialConflict<T, string, ParserContext<T>>[];
  }) {
    super(data);
  }

  protected resolve(
    type: ConflictType,
    another: Definition,
    next: string,
    reduce: boolean | Accepter<T, string, ParserContext<T>>,
    handleEnd: boolean
  ) {
    const anotherRule = defToTempGRs<T, string, ParserContext<T>>(another)[0];
    // TODO: use a dedicated lexer to parse next
    const nextGrammars =
      next.length > 0
        ? defToTempGRs<T, string, ParserContext<T>>({ "": next })[0].rule
        : [];

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
                  types: [g.toGrammar().toASTNode(ctx.lexer).type],
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

  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-S conflict.
   */
  static resolveRS<T>(
    another: Definition,
    options: {
      next: string;
      reduce?: boolean | Accepter<T, string, ParserContext<T>>;
    }
  ) {
    return new DefinitionContextBuilder<T>({}).resolveRS(another, options);
  }
  /**
   * Create a new DefinitionContextBuilder with a rejecter, which will reject during the R-R conflict.
   */
  static resolveRR<T>(
    another: Definition,
    options: RR_ResolverOptions<T, string, ParserContext<T>>
  ) {
    return new DefinitionContextBuilder<T>({}).resolveRR(another, options);
  }
  static callback<T>(f: Callback<T, string, ParserContext<T>>) {
    return new DefinitionContextBuilder<T>({}).callback(f);
  }
  static rejecter<T>(f: Rejecter<T, string, ParserContext<T>>) {
    return new DefinitionContextBuilder<T>({}).rejecter(f);
  }
  static reducer<T>(
    f: (data: (T | undefined)[], context: ParserContext<T>) => T | undefined
  ) {
    return new DefinitionContextBuilder<T>({}).reducer(f);
  }
}
