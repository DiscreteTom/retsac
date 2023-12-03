import type { Logger } from "../../logger";
import { rejectedActionOutput, ActionInput } from "../action";
import type {
  AcceptedActionOutput,
  ActionOutput,
  ReadonlyAction,
} from "../action";
import type {
  GeneralTokenDataBinding,
  ExtractKinds,
  ExtractData,
  Token,
  ILexerCoreLexOutput,
} from "../model";
import type { Validator } from "./model";
import { anonymousKindPlaceholder } from "./model";

export function executeActions<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
>(
  actions: readonly ReadonlyAction<DataBindings, ActionState, ErrorType>[],
  /**
   * Use this factory to pre-calculate some values and cache them,
   * then we don't need to calculate them again in each iteration.
   */
  validatorFactory: (
    input: ActionInput<ActionState>,
  ) => Validator<DataBindings, ActionState, ErrorType>,
  buffer: string,
  start: number,
  peek: boolean,
  initialRest: string | undefined,
  state: ActionState,
  cb: (
    output: AcceptedActionOutput<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ErrorType
    >,
  ) =>
    | {
        /**
         * If `true`, update `digested` and `rest`.
         */
        updateState: true;
        /**
         * If `true`, stop the iteration and return.
         * If `false`, re-loop all actions.
         *
         * If `updateState` is `false`, `stop` must be `true` to avoid inconsistent state.
         */
        stop: boolean;
        /**
         * If not `null`, the error token will be collected.
         *
         * If `stop` is true, the token will be returned.
         */
        token: Token<DataBindings, ErrorType> | null;
      }
    | {
        updateState: false;
        stop: true;
        token: Token<DataBindings, ErrorType> | null;
      },
  debug: boolean,
  logger: Logger,
  entity: string,
): ILexerCoreLexOutput<DataBindings, ErrorType> {
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

    // all actions will reuse this action input to reuse lazy values
    // so we have to create it outside of the loop
    const input = new ActionInput({
      buffer,
      start: start + digested,
      state,
      peek,
      rest: currentRest,
    });
    const output = traverseActions(
      input,
      // we use validator to skip actions during the loop,
      // don't use filter here so we can avoid creating temporary array
      actions,
      validatorFactory(input),
      debug,
      logger,
      entity,
    );

    if (!output.accept) {
      // all definition checked, no accepted action
      // but the digested, rest and errors might be updated by the last iteration
      // so we have to return them
      return { token: null, digested, rest: currentRest, errors };
    }

    const res = cb(output);

    // accumulate errors
    if (res.token?.error !== undefined) errors.push(res.token);

    if (res.updateState) {
      digested += output.digested;
      currentRest = output.rest.raw;
    }

    // if not update state, must return to avoid inconsistent state
    if (!res.updateState || res.stop)
      return { token: res.token, digested, rest: currentRest, errors };

    // else, non-stop, re-loop all actions
  }
}

/**
 * Find the first action which can accept the input.
 * If no action is accepted, return rejected action output.
 */
function traverseActions<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
>(
  input: ActionInput<ActionState>,
  actions: readonly ReadonlyAction<DataBindings, ActionState, ErrorType>[],
  validator: Validator<DataBindings, ActionState, ErrorType>,
  debug: boolean,
  logger: Logger,
  entity: string,
): ActionOutput<DataBindings, ErrorType> {
  for (const action of actions) {
    const output = tryExecuteAction(
      input,
      action,
      validator,
      debug,
      logger,
      entity,
    );
    if (output.accept) return output;
  }

  if (debug) {
    logger.log({
      entity,
      message: "no accept",
    });
  }
  return rejectedActionOutput;
}

/**
 * Try to apply the action to the input.
 * Return rejected action output if the action is rejected or not pass the validation.
 */
function tryExecuteAction<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
>(
  input: ActionInput<ActionState>,
  action: ReadonlyAction<DataBindings, ActionState, ErrorType>,
  validator: Validator<DataBindings, ActionState, ErrorType>,
  debug: boolean,
  logger: Logger,
  entity: string,
): ActionOutput<DataBindings, ErrorType> {
  const preCheckRes = validator.before(action);
  if (preCheckRes.skip) {
    if (debug) {
      const info = {
        kinds: [...action.possibleKinds].map((k) =>
          k.length === 0 ? anonymousKindPlaceholder : k,
        ),
      };
      logger.log({
        entity,
        message: preCheckRes.skippedActionMessageFormatter(info),
        info,
      });
    }
    return rejectedActionOutput;
  }

  const output = action.exec(input);

  if (!output.accept) {
    // rejected
    if (debug) {
      const info = {
        kinds: [...action.possibleKinds].map((k) =>
          k.length === 0 ? anonymousKindPlaceholder : k,
        ),
      };
      logger.log({
        entity,
        message: `reject: ${info.kinds.join(", ")}`,
        info,
      });
    }
    return output;
  }

  // accepted, validate the output
  const kind = output.kind;
  const postCheckRes = validator.after(action, output);
  if (postCheckRes.accept) {
    // accepted, return
    if (debug) {
      const info = {
        kind: kind || anonymousKindPlaceholder,
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

  // accepted but not pass the validation, reject
  if (debug) {
    const info = {
      kinds: [...action.possibleKinds].map((k) =>
        k.length === 0 ? anonymousKindPlaceholder : k,
      ),
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
  return rejectedActionOutput;
}

export function output2token<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
>(
  output: Readonly<
    AcceptedActionOutput<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ErrorType
    >
  >,
): Token<DataBindings, ErrorType> {
  return {
    kind: output.kind,
    content: output.content,
    start: output.start,
    error: output.error,
    data: output.data,
  } as Token<DataBindings, ErrorType>;
}
