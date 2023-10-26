import { defaultLogger, type Logger } from "../logger";
import type { ActionStateCloner } from "./action";
import { ActionInput, type AcceptedActionOutput } from "./action";
import type { Definition, ILexerCore, Token, TokenDataBinding } from "./model";

/**
 * LexerCore only store ActionState, no LexerState.
 */
export class LexerCore<
  Data,
  ErrorType,
  Kinds extends string,
  DataBindings extends TokenDataBinding<Kinds, Data>,
  ActionState,
> implements ILexerCore<Data, ErrorType, Kinds, DataBindings, ActionState>
{
  state: ActionState;

  constructor(
    readonly defs: readonly Readonly<
      Definition<Data, ErrorType, Kinds, ActionState>
    >[],
    readonly initialState: Readonly<ActionState>,
    readonly stateCloner: ActionStateCloner<ActionState>,
    state?: ActionState,
  ) {
    this.state = state ?? stateCloner(initialState);
  }

  reset() {
    this.state = this.stateCloner(this.initialState);
    return this;
  }

  dryClone() {
    return new LexerCore<Data, ErrorType, Kinds, DataBindings, ActionState>(
      this.defs,
      this.initialState,
      this.stateCloner,
    );
  }

  clone() {
    // clone the current state
    return new LexerCore<Data, ErrorType, Kinds, DataBindings, ActionState>(
      this.defs,
      this.initialState,
      this.stateCloner,
      this.stateCloner(this.state),
    );
  }

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
      /**
       * If `true`, the accepted action's callback will not be executed.
       * @default false
       */
      peek?: boolean;
    }>,
  ): {
    /**
     * `null` if no actions can be accepted or all muted.
     */
    token: Token<ErrorType, Kinds, Data, DataBindings> | null;
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
    errors: Token<ErrorType, Kinds, Data, DataBindings>[];
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
    const errors = [] as Token<ErrorType, Kinds, Data, DataBindings>[];
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
        state: this.state,
        rest,
      });
      // cache the result of `startsWith` to avoid duplicate calculation
      // since we need to check `startsWith` for every definition
      const restMatchExpectation =
        expect.text === undefined ||
        input.buffer.startsWith(expect.text, input.start);
      const res = LexerCore.evaluateDefs(
        input,
        this.defs,
        {
          pre: (def) => ({
            accept:
              // muted actions must be executed
              def.action.maybeMuted ||
              ((expect.kind === undefined || def.kind === expect.kind) && // def.kind match expectation
                restMatchExpectation), // rest head match the text expectation
            rejectMessageFormatter: (info) =>
              `skip (unexpected and never muted): ${info.kind}`,
          }),
          post: (def, output) => ({
            accept:
              // if muted, we don't need to check expectation
              output.muted ||
              // ensure expectation match
              ((expect.kind === undefined || expect.kind === def.kind) &&
                (expect.text === undefined || expect.text === output.content)),
            acceptMessageFormatter: (info) =>
              `accept kind ${info.kind}${info.muted ? "(muted)" : ""}, ${
                info.content.length
              } chars: ${JSON.stringify(info.content)}`,
          }),
        },
        debug,
        logger,
        entity,
      );

      if (res === undefined) {
        // all definition checked, no accept or muted
        return { token: null, digested, rest, errors };
      }

      // update lexer state
      digested += res.output.digested;
      rest = res.output.rest;

      // if not peek, update action state
      if (!(options?.peek ?? false)) {
        res.def.action.callback?.({ output: res.output, input });
      }

      if (res.output.muted) {
        // accept but muted, don't emit token, re-loop all definitions after collecting errors
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(LexerCore.res2token(res.output, res.def));
        }
        continue;
      } else {
        // not muted, emit token after collecting errors
        const token = LexerCore.res2token<
          Data,
          ErrorType,
          Kinds,
          DataBindings,
          ActionState
        >(res.output, res.def);
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
    errors: Token<ErrorType, Kinds, Data, DataBindings>[];
  } {
    const debug = options?.debug ?? false;
    const logger = options?.logger ?? defaultLogger;
    const entity = options?.entity ?? "StatelessLexer.trimStart";

    const start = options?.start ?? 0;
    let rest = options?.rest;
    let digested = 0;
    const errors = [] as Token<ErrorType, Kinds, Data, DataBindings>[];
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
        state: this.state,
        rest,
      });

      const res = LexerCore.evaluateDefs(
        input,
        this.defs,
        {
          pre: (def) => ({
            // if the action may be muted, we can't skip it
            // if the action is never muted, we just reject it
            accept: def.action.maybeMuted,
            rejectMessageFormatter: (info) =>
              `skip (never muted): ${info.kind}`,
          }),
          post: () => ({
            accept: true,
            acceptMessageFormatter: (info) =>
              info.muted
                ? `trim ${info.kind}, ${
                    info.content.length
                  } chars: ${JSON.stringify(info.content)}`
                : `found unmuted ${info.kind}, ${
                    info.content.length
                  } chars: ${JSON.stringify(info.content)}`,
          }),
        },
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
          errors.push(LexerCore.res2token(res.output, res.def));
        }
        continue;
      } else {
        // not muted, don't update state, return after collecting errors
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(LexerCore.res2token(res.output, res.def));
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
  static evaluateDefs<Data, ErrorType, Kinds extends string, ActionState>(
    input: ActionInput<ActionState>,
    defs: readonly Readonly<Definition<Data, ErrorType, Kinds, ActionState>>[],
    validator: {
      pre: (def: Readonly<Definition<Data, ErrorType, Kinds, ActionState>>) => {
        accept: boolean;
        rejectMessageFormatter: (info: { kind: string | Kinds }) => string;
      };
      post: (
        def: Readonly<Definition<Data, ErrorType, Kinds, ActionState>>,
        output: AcceptedActionOutput<Data, ErrorType>,
      ) => {
        accept: boolean;
        acceptMessageFormatter: (info: {
          kind: string | Kinds;
          muted: boolean;
          content: string;
        }) => string;
      };
    },
    debug: boolean,
    logger: Logger,
    entity: string,
  ) {
    for (const def of defs) {
      const output = LexerCore.tryDefinition(
        input,
        def,
        validator,
        debug,
        logger,
        entity,
      );
      if (output !== undefined) {
        return { output, def };
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
   * Try to apply the definition's action to the input.
   * Return the action's output if accepted and expected.
   * Return `undefined` if the definition is rejected or unexpected.
   */
  static tryDefinition<Data, ErrorType, Kinds extends string, ActionState>(
    input: ActionInput<ActionState>,
    def: Readonly<Definition<Data, ErrorType, Kinds, ActionState>>,
    validator: {
      pre: (def: Readonly<Definition<Data, ErrorType, Kinds, ActionState>>) => {
        accept: boolean;
        rejectMessageFormatter: (info: { kind: string | Kinds }) => string;
      };
      post: (
        def: Readonly<Definition<Data, ErrorType, Kinds, ActionState>>,
        output: AcceptedActionOutput<Data, ErrorType>,
      ) => {
        accept: boolean;
        acceptMessageFormatter: (info: {
          kind: string | Kinds;
          muted: boolean;
          content: string;
        }) => string;
      };
    },
    debug: boolean,
    logger: Logger,
    entity: string,
  ) {
    const preCheckRes = validator.pre(def);
    if (!preCheckRes.accept) {
      // unexpected
      if (debug) {
        const info = { kind: def.kind || "<anonymous>" };
        logger.log({
          entity,
          message: preCheckRes.rejectMessageFormatter(info),
          info,
        });
      }
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
    const postCheckRes = validator.post(def, output);
    if (postCheckRes.accept) {
      // accepted, return
      if (debug) {
        const info = {
          kind: def.kind || "<anonymous>",
          muted: output.muted,
          content: output.content,
        };
        logger.log({
          entity,
          message: postCheckRes.acceptMessageFormatter(info),
          info,
        });
      }
      return output;
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

  static res2token<
    Data,
    ErrorType,
    Kinds extends string,
    DataBindings extends TokenDataBinding<Kinds, Data>,
    ActionState,
  >(
    res: Readonly<AcceptedActionOutput<Data, ErrorType>>,
    def: Readonly<Definition<Data, ErrorType, Kinds, ActionState>>,
  ): Token<ErrorType, Kinds, Data, DataBindings> {
    return {
      kind: def.kind,
      content: res.content,
      start: res.start,
      error: res.error,
      data: res.data,
    } as Token<ErrorType, Kinds, Data, DataBindings>;
  }
}
