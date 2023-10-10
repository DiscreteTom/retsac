import { defaultLogger, type Logger } from "../logger";
import { ActionInput, type AcceptedActionOutput } from "./action";
import type { Definition, IStatelessLexer, Token } from "./model";

export class StatelessLexer<ErrorType, Kinds extends string>
  implements IStatelessLexer<ErrorType, Kinds>
{
  constructor(
    readonly defs: readonly Readonly<Definition<ErrorType, Kinds>>[],
  ) {}

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
      const res = StatelessLexer.evaluateDefs(
        input,
        this.defs,
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

      const res = StatelessLexer.evaluateDefs(
        input,
        this.defs,
        { muted: true },
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
   * Find the first definition which can accept the input (including muted).
   * If no definition is accepted, return `undefined`.
   *
   * If the result token is muted, it may not match the expectation's kind/text.
   *
   * Set `expect.muted` to `true` doesn't guarantee the result token is muted.
   */
  static evaluateDefs<ErrorType, Kinds extends string>(
    input: ActionInput,
    defs: readonly Readonly<Definition<ErrorType, Kinds>>[],
    expect: Readonly<{ kind?: Kinds; text?: string; muted?: boolean }>, // TODO: muted is confusing, should move it to a new param
    debug: boolean,
    logger: Logger,
    entity: string,
  ) {
    // cache the result of `startsWith` to avoid duplicate calculation
    // since we need to check `startsWith` for every definition
    const restMatchExpectation =
      expect.text === undefined ||
      input.buffer.startsWith(expect.text, input.start);

    for (const def of defs) {
      const res = StatelessLexer.tryDefinition(
        input,
        def,
        expect,
        restMatchExpectation,
        debug,
        logger,
        entity,
      );
      if (res !== undefined) {
        return res;
      }
    }

    if (debug) {
      logger.log({
        entity,
        message: "no accept",
      });
    }
    return undefined;
  }

  /**
   * Return `undefined` if the definition can't accept the input(unexpected or reject).
   */
  static tryDefinition<ErrorType, Kinds extends string>(
    input: ActionInput,
    def: Readonly<Definition<ErrorType, Kinds>>,
    expect: Readonly<{ kind?: Kinds; text?: string; muted?: boolean }>,
    restMatchExpectation: boolean,
    debug: boolean,
    logger: Logger,
    entity: string,
  ) {
    // reject if expectation mismatch before exec
    if (
      // if the action may be muted, we can't skip it
      // because muted tokens are always accepted even mismatch the expectation
      // so we have to ensure the action is never muted
      !def.action.maybeMuted &&
      (expect.muted || // if we expect muted, and the action is never muted, should skip
        (expect.kind !== undefined && def.kind != expect.kind) || // def.kind mismatch, should skip
        !restMatchExpectation) // rest head mismatch the text, should skip
    ) {
      if (debug) {
        const info = { kind: def.kind || "<anonymous>" };
        logger.log({
          entity,
          message: `skip (unexpected and never muted): ${info.kind}`,
          info,
        });
      }
      // unexpected, try next def
      return;
    }

    const output = def.action.exec(input);

    if (!output.accept) {
      // rejected
      if (debug) {
        const info = { kind: def.kind || "<anonymous>" };
        logger.log({
          entity,
          message: `reject: ${info.kind}`,
          info,
        });
      }
      return;
    }

    // accepted, check expectation
    if (
      // if muted, we don't need to check expectation
      output.muted ||
      // if user provide expected kind, reject unmatched kind
      ((expect.kind === undefined || expect.kind === def.kind) &&
        // if user provide expected text, reject unmatched text
        (expect.text === undefined || expect.text === output.content))
    ) {
      // accepted (muted or expected), return
      if (debug) {
        const info = {
          kind: def.kind || "<anonymous>",
          muted: output.muted,
          content: output.content,
        };
        logger.log({
          entity,
          message: `accept kind ${info.kind}${info.muted ? "(muted)" : ""}, ${
            info.content.length
          } chars: ${JSON.stringify(info.content)}`,
          info,
        });
      }
      return { output, def };
    }

    // accepted but unexpected and not muted, reject
    if (debug) {
      const info = {
        kind: def.kind || "<anonymous>",
        content: output.content,
      };
      logger.log({
        entity,
        message: `unexpected ${info.kind}: ${JSON.stringify(info.content)}`,
        info,
      });
    }
    return;
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
