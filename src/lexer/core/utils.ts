import { anonymousKindPlaceholder } from "../../anonymous";
import type { Logger } from "../../logger";
import { ActionInput } from "../action";
import type { ActionOutput, ReadonlyAction } from "../action";
import { Token } from "../model";
import type {
  GeneralTokenDataBinding,
  ExtractKinds,
  ExtractData,
  ILexerCoreLexOutput,
} from "../model";
import type { Validator } from "./model";

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
    input: ActionInput<ActionState>,
    output: ActionOutput<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ErrorType
    >,
  ) => (
    | {
        /**
         * If `true`, update `digested` and `rest`.
         */
        updateCtx: true;
        /**
         * Only effective when `updateCtx` is `true`.
         * If `updateCtx` is `false`, iteration must be stopped to avoid inconsistent context.
         *
         * If `true`, stop the iteration and return.
         * If `false`, re-loop all actions.
         */
        stop: boolean;
      }
    | { updateCtx: false }
  ) & {
    /**
     * If not `null`, the error token will be collected.
     *
     * If `stop` is true, the token will be returned.
     */
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

    if (output === undefined) {
      // all definition checked, no accepted action
      // but the digested, rest and errors might be updated by the last iteration
      // so we have to return them
      return { token: null, digested, rest: currentRest, errors };
    }

    const res = cb(input, output);

    // accumulate errors
    if (res.token?.error !== undefined) errors.push(res.token);

    if (res.updateCtx) {
      digested += output.digested;
      currentRest = output.rest;
    }

    // if not update state, must return to avoid inconsistent state
    if (!res.updateCtx || res.stop)
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
):
  | ActionOutput<DataBindings["kind"], DataBindings["data"], ErrorType>
  | undefined {
  for (const action of actions) {
    const output = tryExecuteAction(
      input,
      action,
      validator,
      debug,
      logger,
      entity,
    );
    if (output !== undefined) return output;
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
):
  | ActionOutput<DataBindings["kind"], DataBindings["data"], ErrorType>
  | undefined {
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
    return undefined;
  }

  const output = action.exec(input);

  if (output === undefined) {
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
  const postCheckRes = validator.after(output);
  if (postCheckRes.accept) {
    // accepted, return
    if (debug) {
      const info = {
        kind: kind || anonymousKindPlaceholder,
        muted: output.muted,
        content: input.buffer.slice(input.start, input.start + output.digested),
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
      content: input.buffer.slice(input.start, input.start + output.digested),
    };
    logger.log({
      entity,
      message: `unexpected ${info.kinds.join(", ")}: ${JSON.stringify(
        info.content,
      )}`,
      info,
    });
  }
  return undefined;
}

export function output2token<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
>(
  input: ActionInput<unknown>,
  output: Readonly<
    ActionOutput<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ErrorType
    >
  >,
): Token<DataBindings, ErrorType> {
  return Token.from(
    output.kind,
    output.data,
    input.buffer,
    {
      start: input.start,
      end: input.start + output.digested,
    },
    output.error,
  ) as Token<DataBindings, ErrorType>;
}
