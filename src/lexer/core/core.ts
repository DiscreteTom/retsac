import { defaultLogger } from "../../logger";
import type { ActionStateCloner, ReadonlyAction } from "../action";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexerCore,
  ILexerCoreLexOptions,
  ILexerCoreLexOutput,
  ILexerCoreTrimStartOptions,
  ILexerCoreTrimStartOutput,
  IReadonlyLexerCore,
} from "../model";
import { executeActions, output2token } from "./utils";

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

    return executeActions(
      // we shouldn't filter actions by expectations here
      // since muted actions can be accepted with unexpected kinds/text
      this.actions,
      (input) => {
        // cache the result of `startsWith` to avoid duplicate calculation
        // since we need to check `startsWith` for every definition
        const textMismatch =
          expect.text !== undefined &&
          !input.buffer.startsWith(expect.text, input.start);
        return {
          before: (action) => ({
            skip:
              // muted actions must be executed no matter what the expectation is
              // so only never muted actions can be skipped
              action.neverMuted &&
              // def.kind mismatch expectation
              ((expect.kind !== undefined &&
                !action.possibleKinds.has(expect.kind)) ||
                // rest head mismatch the text expectation
                textMismatch),
            skippedActionMessageFormatter: (info) =>
              `skip (unexpected and never muted): ${info.kinds}`,
          }),
          after: (output) => ({
            accept:
              // if muted, we don't need to check expectation
              output.muted ||
              // ensure expectation match
              ((expect.kind === undefined || expect.kind === output.kind) &&
                (expect.text === undefined || expect.text === output.content)),
            acceptMessageFormatter: (info) =>
              `accept kind ${info.kind}${info.muted ? "(muted)" : ""}, ${
                info.content.length
              } chars: ${JSON.stringify(info.content)}`,
          }),
        };
      },
      buffer,
      start,
      peek,
      initialRest,
      this.state,
      (output) => {
        if (output.muted) {
          // accept but muted, don't emit token, just collect errors and re-loop all definitions
          return {
            updateCtx: true,
            stop: false,
            token: output.error !== undefined ? output2token(output) : null,
          };
        }

        // not muted, emit token, collect errors and stop
        return {
          updateCtx: true,
          stop: true,
          token: output2token(output),
        };
      },
      debug,
      logger,
      entity,
    );
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
    const { debug, logger, rest: initialRest, start, entity } = options;

    return executeActions(
      this.actions,
      () => ({
        before: (action) => ({
          // if the action may be muted, we can't skip it
          // if the action is never muted, we just reject it
          skip: action.neverMuted,
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
      }),
      buffer,
      start,
      false,
      initialRest,
      this.state,
      (output) => {
        if (output.muted) {
          // accept but muted, don't emit token, just collect errors and re-loop all definitions
          return {
            updateCtx: true,
            stop: false,
            token: output.error !== undefined ? output2token(output) : null,
          };
        }

        // else, not muted, don't update state and collect errors, stop
        return {
          updateCtx: false,
          stop: true,
          token: null,
        };
      },
      debug,
      logger,
      entity,
    );
  }
}
