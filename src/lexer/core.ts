import { defaultLogger, type Logger } from "../logger";
import type { ActionStateCloner } from "./action";
import { ActionInput, type AcceptedActionOutput } from "./action";
import type {
  Definition,
  ExtractAllDefinitions,
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexerCore,
  Token,
  ExtractDefinition,
  ExtractData,
  ILexerCoreLexOptions,
  ILexerCoreLexOutput,
  ILexerCoreTrimStartOptions,
  ILexerCoreTrimStartOutput,
} from "./model";

/**
 * LexerCore only store ActionState, no LexerState.
 */
export class LexerCore<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> implements ILexerCore<DataBindings, ActionState, ErrorType>
{
  state: ActionState;

  constructor(
    readonly defs: ExtractAllDefinitions<DataBindings, ActionState, ErrorType>,
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
    return new LexerCore<DataBindings, ActionState, ErrorType>(
      this.defs,
      this.initialState,
      this.stateCloner,
    );
  }

  clone() {
    return new LexerCore<DataBindings, ActionState, ErrorType>(
      this.defs,
      this.initialState,
      this.stateCloner,
      // clone the current state
      this.stateCloner(this.state),
    );
  }

  lex(
    buffer: string,
    options?: Readonly<Partial<ILexerCoreLexOptions<DataBindings>>>,
  ): ILexerCoreLexOutput<DataBindings, ErrorType> {
    return this._lex(buffer, {
      start: options?.start ?? 0,
      rest: options?.rest,
      debug: options?.debug ?? false,
      logger: options?.logger ?? defaultLogger,
      entity: options?.entity ?? "LexerCore.lex",
      expect: options?.expect ?? {},
      peek: options?.peek ?? false,
    });
  }

  _lex(
    buffer: string,
    options: Readonly<ILexerCoreLexOptions<DataBindings>>,
  ): ILexerCoreLexOutput<DataBindings, ErrorType> {
    const { debug, logger, entity, expect, start, rest, peek } = options;

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

    let currentRest = rest;
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
        return { token: null, digested, rest: currentRest, errors };
      }

      // all defs will reuse this action input to reuse lazy values
      // so we have to create it outside the loop
      const input = new ActionInput({
        buffer,
        start: start + digested,
        state: this.state,
        peek,
        rest: currentRest,
      });
      // cache the result of `startsWith` to avoid duplicate calculation
      // since we need to check `startsWith` for every definition
      const restMatchExpectation =
        expect.text === undefined ||
        input.buffer.startsWith(expect.text, input.start);
      const res = LexerCore.evaluateDefs(
        input,
        // IMPORTANT!: we can't only evaluate the definitions which match the expectation kind
        // because some token may be muted, and we need to check the rest of the input
        this.defs,
        {
          // TODO: don't use callback functions
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
        return { token: null, digested, rest: currentRest, errors };
      }

      // update lexer state
      digested += res.output.digested;
      currentRest = res.output.rest.raw;

      if (res.output.muted) {
        // accept but muted, don't emit token, re-loop all definitions after collecting errors
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(LexerCore.output2token(res.kind, res.output));
        }
        continue;
      } else {
        // not muted, emit token after collecting errors
        const token = LexerCore.output2token<DataBindings, ErrorType>(
          res.kind,
          res.output,
        );
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(token);
        }
        return { token, digested, rest: currentRest, errors };
      }
    }
  }

  trimStart(
    buffer: string,
    options?: Readonly<Partial<ILexerCoreTrimStartOptions>>,
  ): ILexerCoreTrimStartOutput<DataBindings, ErrorType> {
    return this._trimStart(buffer, {
      debug: options?.debug ?? false,
      entity: options?.entity ?? "LexerCore.trimStart",
      logger: options?.logger ?? defaultLogger,
      rest: options?.rest,
      start: options?.start ?? 0,
    });
  }

  _trimStart(
    buffer: string,
    options: Readonly<ILexerCoreTrimStartOptions>,
  ): ILexerCoreTrimStartOutput<DataBindings, ErrorType> {
    const { debug, logger, rest, start, entity } = options;

    let currentRest = rest;
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
        return { digested, rest: currentRest, errors };
      }

      // all defs will reuse this input to reuse lazy values
      const input = new ActionInput({
        buffer,
        start: start + digested,
        state: this.state,
        peek: false,
        rest: currentRest,
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
        return { digested, rest: currentRest, errors };
      }

      if (res.output.muted) {
        // accept but muted
        // re-loop all definitions after update states
        digested += res.output.digested;
        currentRest = res.output.rest.raw;
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
        return { digested, rest: currentRest, errors };
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
  static evaluateDefs<
    DataBindings extends GeneralTokenDataBinding,
    ActionState,
    ErrorType,
  >(
    input: ActionInput<ActionState>,
    defs: ExtractAllDefinitions<DataBindings, ActionState, ErrorType>,
    validator: {
      pre: (
        def: Readonly<ExtractDefinition<DataBindings, ActionState, ErrorType>>,
      ) => {
        accept: boolean;
        rejectMessageFormatter: (info: {
          kinds: (string | ExtractKinds<DataBindings>)[];
        }) => string;
      };
      post: (
        def: Readonly<ExtractDefinition<DataBindings, ActionState, ErrorType>>,
        output: AcceptedActionOutput<ExtractData<DataBindings>, ErrorType>,
      ) => {
        accept: boolean;
        acceptMessageFormatter: (info: {
          kind: string | ExtractKinds<DataBindings>;
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
        rejectMessageFormatter: (info: { kinds: (string | Kinds)[] }) => string;
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
          kinds: [...def.kinds].map((k) =>
            k.length === 0 ? "<anonymous>" : k,
          ),
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
        const info = {
          kinds: [...def.kinds].map((k) =>
            k.length === 0 ? "<anonymous>" : k,
          ),
        };
        logger.log({
          entity,
          message: `reject: ${info.kinds.join(", ")}`,
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
        kinds: [...def.kinds].map((k) => (k.length === 0 ? "<anonymous>" : k)),
        content: output.content,
      };
      logger.log({
        entity,
        message: `unexpected ${info.kinds.join(", ")}: ${JSON.stringify(
          info.content,
        )}`,
        info,
      });
    }
    return;
  }

  static output2token<DataBindings extends GeneralTokenDataBinding, ErrorType>(
    kind: ExtractKinds<DataBindings>,
    output: Readonly<
      AcceptedActionOutput<ExtractData<DataBindings>, ErrorType>
    >,
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
