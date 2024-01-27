import { defaultLogger } from "../../logger";
import type { ReadonlyAction } from "../action";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexerCoreLexOptions,
  ILexerCoreLexOutput,
  ILexerCoreTrimStartOptions,
  ILexerCoreTrimStartOutput,
} from "../model";
import { executeActions, output2token } from "./utils";

export class LexerCore<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> {
  constructor(
    readonly actions: readonly ReadonlyAction<
      DataBindings,
      ActionState,
      ErrorType
    >[],
  ) {}

  getTokenKinds() {
    const res: Set<ExtractKinds<DataBindings>> = new Set();
    this.actions.forEach((a) => a.possibleKinds.forEach((k) => res.add(k)));
    return res;
  }

  lex(
    buffer: string,
    options: Readonly<ILexerCoreLexOptions<DataBindings, ActionState>>,
  ): ILexerCoreLexOutput<DataBindings, ErrorType> {
    const {
      debug,
      logger,
      entity,
      expect,
      start,
      rest: initialRest,
      actionState,
      peek,
    } = options;

    // debug output
    if (debug) {
      if (expect?.kind !== undefined || expect?.text !== undefined) {
        const info = { expect };
        (logger ?? defaultLogger).log({
          entity: entity ?? "LexerCore.lex",
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
          expect?.text !== undefined &&
          !input.buffer.startsWith(expect.text, input.start);
        return {
          before: (action) => ({
            skip:
              // muted actions must be executed no matter what the expectation is
              // so only never muted actions can be skipped
              action.neverMuted &&
              // def.kind mismatch expectation
              ((expect?.kind !== undefined &&
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
              ((expect?.kind === undefined || expect.kind === output.kind) &&
                (expect?.text === undefined ||
                  expect.text ===
                    input.buffer.slice(
                      input.start,
                      input.start + output.digested,
                    ))),
            acceptMessageFormatter: (info) =>
              `accept kind ${info.kind}${info.muted ? "(muted)" : ""}, ${
                info.content.length
              } chars: ${JSON.stringify(info.content)}`,
          }),
        };
      },
      buffer,
      start ?? 0,
      peek ?? false,
      initialRest,
      actionState,
      (input, output) => {
        if (output.muted) {
          // accept but muted, don't emit token, just collect errors and re-loop all definitions
          return {
            updateCtx: true,
            stop: false,
            token:
              output.error !== undefined ? output2token(input, output) : null,
          };
        }

        // not muted, emit token, collect errors and stop
        return {
          updateCtx: true,
          stop: true,
          token: output2token(input, output),
        };
      },
      debug ?? false,
      logger ?? defaultLogger,
      entity ?? "LexerCore.lex",
    );
  }

  trimStart(
    buffer: string,
    options: Readonly<ILexerCoreTrimStartOptions<ActionState>>,
  ): ILexerCoreTrimStartOutput<DataBindings, ErrorType> {
    const {
      debug,
      logger,
      rest: initialRest,
      start,
      entity,
      actionState,
    } = options;

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
      start ?? 0,
      false,
      initialRest,
      actionState,
      (input, output) => {
        if (output.muted) {
          // accept but muted, don't emit token, just collect errors and re-loop all definitions
          return {
            updateCtx: true,
            stop: false,
            token:
              output.error !== undefined ? output2token(input, output) : null,
          };
        }

        // else, not muted, don't update state and collect errors, stop
        return {
          updateCtx: false,
          stop: true,
          token: null,
        };
      },
      debug ?? false,
      logger ?? defaultLogger,
      entity ?? "LexerCore.trimStart",
    );
  }
}
