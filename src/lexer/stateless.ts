import type { Logger } from "../logger";
import { lex } from "./core";
import type { Definition } from "./model";

export class StatelessLexer<ErrorType, Kinds extends string> {
  constructor(
    readonly defs: readonly Readonly<Definition<ErrorType, Kinds>>[],
  ) {}

  lex(
    /**
     * The whole input string.
     */
    buffer: string,
    options: Readonly<{
      /**
       * From which char of the input string to start lexing.
       */
      start: number;
      /**
       * If NOT `undefined`, the value should be `input.slice(options.offset)`.
       * This is to optimize the performance if some actions need to get the rest of the input.
       */
      rest: string | undefined;
      expect: Readonly<{
        kind?: Kinds;
        text?: string;
      }>;
      debug: boolean;
      logger: Logger;
    }>,
  ) {
    return lex(buffer, this.defs, options);
  }
}
