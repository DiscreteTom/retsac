import type { ActionSource } from "./action";
import { Action } from "./action";
import { Lexer } from "./lexer";
import type { Definition, ILexer } from "./model";
import { StatelessLexer } from "./stateless";

export type LexerBuildOptions = Partial<
  Pick<ILexer<unknown, string>, "logger" | "debug">
>;

/**
 * Lexer builder.
 */
export class Builder<ErrorType = string, Kinds extends string = never> {
  private defs: Readonly<Definition<ErrorType, Kinds>>[];

  constructor() {
    this.defs = [];
  }

  /**
   * Define token kinds.
   */
  define<Append extends string>(defs: {
    [kind in Append]: ActionSource<ErrorType> | ActionSource<ErrorType>[];
  }): Builder<ErrorType, Kinds | Append> {
    for (const kind in defs) {
      const raw = defs[kind] as
        | ActionSource<ErrorType>
        | ActionSource<ErrorType>[];

      // IMPORTANT: DON'T use Action.reduce to merge multi actions into one
      // because when we lex with expectation, we should evaluate actions one by one

      (raw instanceof Array ? raw : [raw]).forEach((a) => {
        (this as Builder<ErrorType, Kinds | Append>).defs.push({
          kind,
          action: Action.from(a),
        });
      });
    }
    return this;
  }

  /**
   * Define tokens with empty kind.
   */
  anonymous(...actions: ActionSource<ErrorType>[]) {
    return this.define({ "": actions });
  }

  /**
   * Define muted anonymous actions.
   */
  ignore(...actions: ActionSource<ErrorType>[]) {
    return this.define({ "": actions.map((a) => Action.from(a).mute()) });
  }

  /**
   * Get all defined token kinds.
   */
  getTokenKinds() {
    // `this.build` is lightweight, so we don't cache the result
    return this.build().getTokenKinds();
  }

  build(options?: LexerBuildOptions) {
    return new Lexer<ErrorType, Kinds>(new StatelessLexer(this.defs), options);
  }
}
