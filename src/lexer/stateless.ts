import { defaultLogger, type Logger } from "../logger";
import { ActionInput, type AcceptedActionOutput } from "./action";
import type { Definition, Token } from "./model";

// TODO: extract interface
export class StatelessLexer<ErrorType, Kinds extends string> {
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

      /** Set this to `true` if any action is muted. */
      let muted = false;
      // all defs will reuse this action input to reuse lazy values
      // so we have to create it outside the loop
      const input = new ActionInput({
        buffer,
        start: start + digested,
        rest,
      });
      for (const def of this.defs) {
        // if user provide expected kind/text, ignore unmatched kind/text
        // unless it's muted(still can be accepted but not emit).
        if (
          // if an action is never muted, we can skip it safely after checking expectation
          !def.action.maybeMuted &&
          // skip if expectation mismatch
          ((expect.kind !== undefined && def.kind != expect.kind) ||
            (expect.text !== undefined &&
              !buffer.startsWith(expect.text, start + digested)))
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

        const res = def.action.exec(input);
        if (
          res.accept &&
          // if user provide expected kind, reject unmatched kind
          (expect.kind === undefined ||
            expect.kind === def.kind ||
            // but if the unmatched kind is muted (e.g. ignored), accept it
            res.muted) &&
          // if user provide expected text, reject unmatched text
          (expect.text === undefined ||
            expect.text === res.content ||
            // but if the unmatched text is muted (e.g. ignored), accept it
            res.muted)
        ) {
          if (debug) {
            const info = {
              kind: def.kind || "<anonymous>",
              muted: res.muted,
              content: res.content,
            };
            logger.log({
              entity,
              message: `accept kind ${info.kind}${
                info.muted ? "(muted)" : ""
              }, ${info.content.length} chars: ${JSON.stringify(info.content)}`,
              info,
            });
          }

          // construct token
          const token = this.res2token(res, def);

          // update state, collect errors
          digested += res.digested;
          rest = res._rest;
          if (res.error !== undefined) errors.push(token);

          if (!res.muted) {
            // not muted, emit token
            return { token, digested, rest, errors };
          } else {
            // accept but muted, don't emit token, re-loop all definitions
            muted = true;
            break; // break the iteration of definitions
          }
        } else {
          // not accept or unexpected

          // if not accept, try next def
          if (!res.accept) {
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
          // below won't happen, res.muted is always false here
          // else if (res.muted)
          //   if(debug) logger(
          //     `[Lexer.lex] muted: ${
          //       def.kind || "<anonymous>"
          //     } content: ${JSON.stringify(res.content)}`
          //   );
          else {
            // unexpected, try next def
            if (debug) {
              const info = {
                kind: def.kind || "<anonymous>",
                content: res.content,
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
        }
      } // end of defs iteration
      if (!muted) {
        // all definition checked, no accept or muted
        if (debug) {
          logger.log({
            entity,
            message: "no accept",
          });
        }
        return { token: null, digested, rest, errors };
      }
      // else, muted, re-loop all definitions
    }
  }

  res2token(
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
