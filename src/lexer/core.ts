import { defaultLogger, type Logger } from "../logger";
import type { ActionStateCloner } from "./action";
import { ActionInput, type AcceptedActionOutput } from "./action";
import type { Definition, ILexerCore, Token, TokenDataBinding } from "./model";

/**
 * LexerCore only store ActionState, no LexerState.
 */
export class LexerCore<
  Kinds extends string,
  Data,
  DataBindings extends TokenDataBinding<Kinds, Data>,
  ActionState,
  ErrorType,
> implements ILexerCore<Kinds, Data, DataBindings, ActionState, ErrorType>
{
  state: ActionState;

  constructor(
    readonly defs: readonly Readonly<
      Definition<Kinds, Data, ActionState, ErrorType>
    >[],
    readonly defMap: ReadonlyMap<
      Kinds,
      Readonly<Definition<Kinds, Data, ActionState, ErrorType>>[]
    >,
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
    return new LexerCore<Kinds, Data, DataBindings, ActionState, ErrorType>(
      this.defs,
      this.defMap,
      this.initialState,
      this.stateCloner,
    );
  }

  clone() {
    // clone the current state
    return new LexerCore<Kinds, Data, DataBindings, ActionState, ErrorType>(
      this.defs,
      this.defMap,
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
       * @default "LexerCore.lex"
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
    token: Token<DataBindings, ErrorType> | null;
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
    errors: Token<DataBindings, ErrorType>[];
  } {
    const debug = options?.debug ?? false;
    const logger = options?.logger ?? defaultLogger;
    const expect = options?.expect ?? {};
    const entity = options?.entity ?? "LexerCore.lex";

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
    const errors = [] as Token<DataBindings, ErrorType>[];
    const peek = options?.peek ?? false;
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
        peek,
      });
      // cache the result of `startsWith` to avoid duplicate calculation
      // since we need to check `startsWith` for every definition
      const restMatchExpectation =
        expect.text === undefined ||
        input.buffer.startsWith(expect.text, input.start);
      const res = LexerCore.evaluateDefs(
        input,
        expect.kind === undefined
          ? this.defs
          : this.defMap.get(expect.kind) ?? [],
        {
          pre: (def) => ({
            accept:
              // muted actions must be executed
              def.action.maybeMuted ||
              ((expect.kind === undefined || def.kinds.has(expect.kind)) && // def.kind match expectation
                restMatchExpectation), // rest head match the text expectation
            rejectMessageFormatter: (info) =>
              `skip (unexpected and never muted): ${info.kinds}`,
          }),
          post: (def, output) => ({
            accept:
              // if muted, we don't need to check expectation
              output.muted ||
              // ensure expectation match
              ((expect.kind === undefined || def.kinds.has(expect.kind)) &&
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

      if (res.output.muted) {
        // accept but muted, don't emit token, re-loop all definitions after collecting errors
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(LexerCore.output2token(res.kind, res.output));
        }
        continue;
      } else {
        // not muted, emit token after collecting errors
        const token = LexerCore.output2token<
          Kinds,
          Data,
          DataBindings,
          ErrorType
        >(res.kind, res.output);
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
       * @default "LexerCore.lex"
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
    errors: Token<DataBindings, ErrorType>[];
  } {
    const debug = options?.debug ?? false;
    const logger = options?.logger ?? defaultLogger;
    const entity = options?.entity ?? "LexerCore.trimStart";

    const start = options?.start ?? 0;
    let rest = options?.rest;
    let digested = 0;
    const errors = [] as Token<DataBindings, ErrorType>[];
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
        peek: false,
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
              `skip (never muted): ${info.kinds}`,
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
          errors.push(LexerCore.output2token(res.kind, res.output));
        }
        continue;
      } else {
        // not muted, don't update state, return after collecting errors
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(LexerCore.output2token(res.kind, res.output));
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
  static evaluateDefs<Kinds extends string, Data, ActionState, ErrorType>(
    input: ActionInput<ActionState>,
    defs: readonly Readonly<Definition<Kinds, Data, ActionState, ErrorType>>[],
    validator: {
      pre: (def: Readonly<Definition<Kinds, Data, ActionState, ErrorType>>) => {
        accept: boolean;
        rejectMessageFormatter: (info: { kinds: string }) => string;
      };
      post: (
        def: Readonly<Definition<Kinds, Data, ActionState, ErrorType>>,
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
      const res = LexerCore.tryDefinition(
        input,
        def,
        validator,
        debug,
        logger,
        entity,
      );
      if (res !== undefined) {
        return { ...res, def };
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
  static tryDefinition<Kinds extends string, Data, ActionState, ErrorType>(
    input: ActionInput<ActionState>,
    def: Readonly<Definition<Kinds, Data, ActionState, ErrorType>>,
    validator: {
      pre: (def: Readonly<Definition<Kinds, Data, ActionState, ErrorType>>) => {
        accept: boolean;
        rejectMessageFormatter: (info: { kinds: string }) => string;
      };
      post: (
        def: Readonly<Definition<Kinds, Data, ActionState, ErrorType>>,
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
        const info = {
          kinds:
            def.kinds.size === 1 && def.kinds.has("" as Kinds)
              ? "<anonymous>"
              : JSON.stringify(def.kinds),
        };
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
        const info = { kind: def.kinds || "<anonymous>" };
        logger.log({
          entity,
          message: `reject: ${info.kind}`,
          info,
        });
      }
      return;
    }

    // accepted, check expectation
    const kind = def.selector({ input, output });
    const postCheckRes = validator.post(def, output);
    if (postCheckRes.accept) {
      // accepted, return
      if (debug) {
        const info = {
          kind: kind || "<anonymous>",
          muted: output.muted,
          content: output.content,
        };
        logger.log({
          entity,
          message: postCheckRes.acceptMessageFormatter(info),
          info,
        });
      }
      return { output, kind };
    }

    // accepted but unexpected and not muted, reject
    if (debug) {
      const info = {
        kind: def.kinds || "<anonymous>",
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

  static output2token<
    Kinds extends string,
    Data,
    DataBindings extends TokenDataBinding<Kinds, Data>,
    ErrorType,
  >(
    kind: Kinds,
    output: Readonly<AcceptedActionOutput<Data, ErrorType>>,
  ): Token<DataBindings, ErrorType> {
    return {
      kind,
      content: output.content,
      start: output.start,
      error: output.error,
      data: output.data,
    } as Token<DataBindings, ErrorType>;
  }
}
