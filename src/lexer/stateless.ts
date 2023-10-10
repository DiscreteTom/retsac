import { defaultLogger, type Logger } from "../logger";
import { ActionInput, type AcceptedActionOutput } from "./action";
import type { Definition, Token } from "./model";

// TODO: extract interface
export class StatelessLexer<ErrorType, Kinds extends string> {
  constructor(
    readonly defs: readonly Readonly<Definition<ErrorType, Kinds>>[],
  ) {}

  // TODO: better name
  lex(
    /**
     * The whole input string.
     */
    buffer: string,
    options?: Readonly<{
      /**
       * From which char of the input string to start lexing.
       * @default 0
       */
      start?: number;
      /**
       * If NOT `undefined`, the value should be `input.slice(options.offset)`.
       * This is to optimize the performance if some actions need to get the rest of the input.
       * @default undefined
       */
      rest?: string;
      expect?: Readonly<{
        kind?: Kinds;
        text?: string;
      }>;
      /**
       * @default false
       */
      debug?: boolean;
      /**
       * @default defaultLogger
       */
      logger?: Logger;
      /**
       * @default "StatelessLexer.lex"
       */
      entity?: string;
    }>,
  ): {
    /**
     * `null` if no actions can be accepted or all muted.
     */
    token: Token<ErrorType, Kinds> | null;
    /**
     * How many chars are digested during this lex.
     */
    digested: number;
    /**
     * Not `undefined` if the last action's output contains a rest.
     */
    rest: string | undefined;
    /**
     * Accumulated errors during this lex.
     */
    errors: Token<ErrorType, Kinds>[];
  } {
    const debug = options?.debug ?? false;
    const logger = options?.logger ?? defaultLogger;
    const expect = options?.expect ?? {};
    const entity = options?.entity ?? "StatelessLexer.lex";

    // debug output
    if (debug) {
      if (expect.kind !== undefined || expect.text !== undefined) {
        const info = { expect };
        logger.log({
          entity,
          message: `options: ${JSON.stringify(info)}`,
          info,
        });
      }
    }

    const start = options?.start ?? 0;
    let rest = options?.rest;
    let digested = 0;
    const errors = [] as Token<ErrorType, Kinds>[];
    while (true) {
      // first, ensure rest is not empty
      // since maybe some token is muted in the last iteration which cause the rest is empty
      if (start + digested >= buffer.length) {
        if (debug) {
          logger.log({
            entity,
            message: "no rest",
          });
        }
        return { token: null, digested, rest, errors };
      }

      // all defs will reuse this action input to reuse lazy values
      // so we have to create it outside the loop
      const input = new ActionInput({
        buffer,
        start: start + digested,
        rest,
      });
      const res = StatelessLexer.traverseDefs(
        this.defs,
        input,
        expect,
        debug,
        logger,
        entity,
      );

      if (res === undefined) {
        // all definition checked, no accept or muted
        return { token: null, digested, rest, errors };
      }

      // update state
      digested += res.output.digested;
      rest = res.output.rest;

      if (res.output.muted) {
        // accept but muted, don't emit token, re-loop all definitions after collecting errors
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(StatelessLexer.res2token(res.output, res.def));
        }
        continue;
      } else {
        // not muted, emit token after collecting errors
        const token = StatelessLexer.res2token(res.output, res.def);
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(token);
        }
        return { token, digested, rest, errors };
      }
    }
  }

  trimStart(
    buffer: string,
    options?: Readonly<{
      /**
       * From which char of the input string to start lexing.
       * @default 0
       */
      start?: number;
      /**
       * If NOT `undefined`, the value should be `input.slice(options.offset)`.
       * This is to optimize the performance if some actions need to get the rest of the input.
       * @default undefined
       */
      rest?: string;
      /**
       * @default false
       */
      debug?: boolean;
      /**
       * @default defaultLogger
       */
      logger?: Logger;
      /**
       * @default "StatelessLexer.lex"
       */
      entity?: string;
    }>,
  ): {
    /**
     * How many chars are digested during this lex.
     */
    digested: number;
    /**
     * Not `undefined` if the last action's output contains a rest.
     */
    rest: string | undefined;
    /**
     * Accumulated errors during this lex.
     */
    errors: Token<ErrorType, Kinds>[];
  } {
    const debug = options?.debug ?? false;
    const logger = options?.logger ?? defaultLogger;
    const entity = options?.entity ?? "StatelessLexer.trimStart";

    const start = options?.start ?? 0;
    let rest = options?.rest;
    let digested = 0;
    const errors = [] as Token<ErrorType, Kinds>[];
    while (true) {
      // first, ensure rest is not empty
      // since maybe some token is muted in the last iteration which cause the rest is empty
      if (start + digested >= buffer.length) {
        if (debug) {
          logger.log({
            entity,
            message: "no rest",
          });
        }
        return { digested, rest, errors };
      }

      // all defs will reuse this input to reuse lazy values
      const input = new ActionInput({
        buffer,
        start: start + digested,
        rest,
      });

      const res = StatelessLexer.traverseDefs(
        this.defs,
        input,
        {}, // no expectation
        debug,
        logger,
        entity,
      );

      if (res === undefined) {
        // all definition checked, no accept
        return { digested, rest, errors };
      }

      if (res.output.muted) {
        // accept but muted
        // re-loop all definitions after update states
        digested += res.output.digested;
        rest = res.output.rest;
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(StatelessLexer.res2token(res.output, res.def));
        }
        continue;
      } else {
        // not muted, don't update state, return after collecting errors
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(StatelessLexer.res2token(res.output, res.def));
        }
        return { digested, rest, errors };
      }
    }
  }

  /**
   * If any definition is accepted, return the first accepted definition (including muted).
   * If no definition is accepted, return `undefined`.
   */
  // TODO: better name
  static traverseDefs<ErrorType, Kinds extends string>(
    defs: readonly Readonly<Definition<ErrorType, Kinds>>[],
    input: ActionInput,
    expect: Readonly<{ kind?: Kinds; text?: string }>, // TODO: remove this?
    debug: boolean,
    logger: Logger,
    entity: string,
  ) {
    for (const def of defs) {
      // if user provide expected kind/text, ignore unmatched kind/text
      // unless it's muted(still can be accepted but not emit).
      if (
        // if an action is never muted, we can skip it safely after checking expectation
        !def.action.maybeMuted &&
        // skip if expectation mismatch
        ((expect.kind !== undefined && def.kind != expect.kind) ||
          (expect.text !== undefined &&
            !input.buffer.startsWith(expect.text, input.start)))
      ) {
        if (debug) {
          const info = { kind: def.kind || "<anonymous>" };
          logger.log({
            entity,
            message: `skip (unexpected and never muted): ${info.kind}`,
            info,
          });
        }
        // this action is skipped, try next def
        continue;
      }

      const output = def.action.exec(input);
      if (output.accept) {
        if (
          // TODO: extract function: checkExpectation
          // if user provide expected kind, reject unmatched kind
          (expect.kind === undefined ||
            expect.kind === def.kind ||
            // but if the unmatched kind is muted (e.g. ignored), accept it
            output.muted) &&
          // if user provide expected text, reject unmatched text
          (expect.text === undefined ||
            expect.text === output.content ||
            // but if the unmatched text is muted (e.g. ignored), accept it
            output.muted)
        ) {
          // accepted and expected, return
          if (debug) {
            const info = {
              kind: def.kind || "<anonymous>",
              muted: output.muted,
              content: output.content,
            };
            logger.log({
              entity,
              message: `accept kind ${info.kind}${
                info.muted ? "(muted)" : ""
              }, ${info.content.length} chars: ${JSON.stringify(info.content)}`,
              info,
            });
          }
          return { output, def };
        } else {
          // accepted but unexpected, try next def
          if (debug) {
            const info = {
              kind: def.kind || "<anonymous>",
              content: output.content,
            };
            logger.log({
              entity,
              message: `unexpected ${info.kind}: ${JSON.stringify(
                info.content,
              )}`,
              info,
            });
          }
          // try next def
          continue;
        }
      } else {
        // rejected
        if (debug) {
          const info = { kind: def.kind || "<anonymous>" };
          logger.log({
            entity,
            message: `reject: ${info.kind}`,
            info,
          });
        }
        // try next def
        continue;
      }
    } // end of defs iteration

    if (debug) {
      logger.log({
        entity,
        message: "no accept",
      });
    }
    return undefined;
  }

  static res2token<ErrorType, Kinds extends string>(
    res: Readonly<AcceptedActionOutput<ErrorType>>,
    def: Readonly<Definition<ErrorType, Kinds>>,
  ): Token<ErrorType, Kinds> {
    return {
      kind: def.kind,
      content: res.content,
      start: res.start,
      error: res.error,
    };
  }
}
