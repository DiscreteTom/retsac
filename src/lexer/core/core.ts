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
import { executeActions } from "./utils";

export class LexerCore<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> {
  /**
   * This is used to accelerate expected lexing.
   */
  readonly actionMap: ReadonlyMap<
    DataBindings["kind"],
    readonly ReadonlyAction<DataBindings, ActionState, ErrorType>[]
  >;
  /**
   * This is used to accelerate trimming.
   */
  readonly maybeMutedActions: readonly ReadonlyAction<
    DataBindings,
    ActionState,
    ErrorType
  >[];

  constructor(
    readonly actions: readonly ReadonlyAction<
      DataBindings,
      ActionState,
      ErrorType
    >[],
  ) {
    const actionMap = new Map<
      DataBindings["kind"],
      ReadonlyAction<DataBindings, ActionState, ErrorType>[]
    >();
    // prepare action map, add list for all possible kinds
    actions.forEach((a) => {
      a.possibleKinds.forEach((k) => {
        actionMap.set(k, []);
      });
    });
    // fill action map
    actions.forEach((a) => {
      if (a.maybeMuted) {
        // maybe muted, all to all kinds
        actionMap.forEach((v) => v.push(a));
      } else {
        // never muted, only add to possible kinds
        a.possibleKinds.forEach((k) => actionMap.get(k)!.push(a));
      }
    });

    this.actionMap = actionMap;
    this.maybeMutedActions = actions.filter((a) => a.maybeMuted);
  }

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
      expect?.kind === undefined
        ? this.actions // no expectation, use all actions
        : this.actionMap.get(expect.kind) ?? this.actions,
      (input) => {
        // cache the result of `startsWith` to avoid duplicate calculation
        // since we need to check `startsWith` for every definition
        const textMismatch =
          expect?.text !== undefined &&
          !input.buffer.startsWith(expect.text, input.start);
        return {
          skipBeforeExec: (action) => ({
            skip:
              // since we already filtered actions, we only need to skip actions
              // which are never muted and text mismatch
              action.neverMuted && textMismatch,
            skippedActionMessageFormatter: (info) =>
              `skip (unexpected and never muted): ${info.kinds}`,
          }),
          acceptAfterExec: (output) => ({
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
      initialRest,
      actionState,
      { updateLexOutput: true, createToken: true },
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
      this.maybeMutedActions,
      () => ({
        skipBeforeExec: (_) => ({
          // we already filtered actions, so never skip
          skip: false,
          skippedActionMessageFormatter: (info) =>
            `skip (never muted): ${info.kinds}`,
        }),
        acceptAfterExec: () => ({
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
      initialRest,
      actionState,
      { updateLexOutput: false, createToken: false },
      debug ?? false,
      logger ?? defaultLogger,
      entity ?? "LexerCore.trimStart",
    );
  }
}
