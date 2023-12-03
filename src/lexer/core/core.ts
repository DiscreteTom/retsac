import { defaultLogger } from "../../logger";
import type { ActionStateCloner, ReadonlyAction } from "../action";
import { ActionInput } from "../action";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexerCore,
  Token,
  ILexerCoreLexOptions,
  ILexerCoreLexOutput,
  ILexerCoreTrimStartOptions,
  ILexerCoreTrimStartOutput,
  IReadonlyLexerCore,
} from "../model";
import { evaluateActions, output2token } from "./utils";

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
    readonly actions: readonly ReadonlyAction<
      DataBindings,
      ActionState,
      ErrorType
    >[],
    readonly initialState: Readonly<ActionState>,
    readonly stateCloner: ActionStateCloner<ActionState>,
    state?: ActionState,
  ) {
    this.state = state ?? stateCloner(initialState);
  }

  getTokenKinds() {
    const res: Set<ExtractKinds<DataBindings>> = new Set();
    this.actions.forEach((a) => a.possibleKinds.forEach((k) => res.add(k)));
    return res;
  }

  get readonly() {
    return this as IReadonlyLexerCore<DataBindings, ActionState, ErrorType>;
  }

  reset() {
    this.state = this.stateCloner(this.initialState);
    return this;
  }

  dryClone() {
    return new LexerCore<DataBindings, ActionState, ErrorType>(
      this.actions,
      this.initialState,
      this.stateCloner,
    );
  }

  clone() {
    return new LexerCore<DataBindings, ActionState, ErrorType>(
      this.actions,
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
    const {
      debug,
      logger,
      entity,
      expect,
      start,
      rest: initialRest,
      peek,
    } = options;

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

    let currentRest = initialRest;
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
      const textMismatch =
        expect.text !== undefined &&
        !input.buffer.startsWith(expect.text, input.start);
      const res = evaluateActions(
        input,
        // IMPORTANT!: we can't only evaluate the definitions which match the expectation kind
        // because some token may be muted, and we need to check the rest of the input
        // TODO: filter actions here, instead of using `before`?
        this.actions,
        {
          // TODO: don't use callback functions
          before: (def) => ({
            skip:
              // muted actions must be executed no matter what the expectation is
              // so only never muted actions can be skipped
              def.neverMuted &&
              // def.kind mismatch expectation
              ((expect.kind !== undefined &&
                !def.possibleKinds.has(expect.kind)) ||
                // rest head mismatch the text expectation
                textMismatch),
            skippedActionMessageFormatter: (info) =>
              `skip (unexpected and never muted): ${info.kinds}`,
          }),
          after: (def, output) => ({
            accept:
              // if muted, we don't need to check expectation
              output.muted ||
              // ensure expectation match
              ((expect.kind === undefined ||
                def.possibleKinds.has(expect.kind)) &&
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
          errors.push(output2token(res.output.kind, res.output));
        }
        continue;
      } else {
        // not muted, emit token after collecting errors
        const token = output2token<DataBindings, ErrorType>(
          res.output.kind,
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

      const res = evaluateActions(
        input,
        this.actions,
        {
          before: (def) => ({
            // if the action may be muted, we can't skip it
            // if the action is never muted, we just reject it
            skip: def.neverMuted,
            skippedActionMessageFormatter: (info) =>
              `skip (never muted): ${info.kinds}`,
          }),
          after: () => ({
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
          errors.push(output2token(res.output.kind, res.output));
        }
        continue;
      } else {
        // not muted, don't update state, return after collecting errors
        if (res.output.error !== undefined) {
          // collect errors
          errors.push(output2token(res.output.kind, res.output));
        }
        return { digested, rest: currentRest, errors };
      }
    }
  }
}
