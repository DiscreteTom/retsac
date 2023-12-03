import type { Logger } from "../../logger";
import type {
  AcceptedActionOutput,
  ActionInput,
  ReadonlyAction,
} from "../action";
import type {
  GeneralTokenDataBinding,
  ExtractKinds,
  ExtractData,
  Token,
} from "../model";
import type { Validator } from "./model";
import { anonymousKindPlaceholder } from "./model";

/**
 * Find the first definition which can accept the input (including muted).
 * If no definition is accepted, return `undefined`.
 *
 * If the result token is muted, it may not match the expectation's kind/text.
 *
 * Set `expect.muted` to `true` doesn't guarantee the result token is muted.
 */
export function evaluateDefs<
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
) {
  for (const action of actions) {
    const res = tryDefinition(input, action, validator, debug, logger, entity);
    if (res !== undefined) {
      return { ...res, def: action };
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
export function tryDefinition<
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
) {
  const preCheckRes = validator.before(action);
  if (preCheckRes.skip) {
    // unexpected
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
    return;
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
    return;
  }

  // accepted, check expectation
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
    return { output, kind };
  }

  // accepted but unexpected and not muted, reject
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
  return;
}

export function output2token<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
>(
  kind: ExtractKinds<DataBindings>,
  output: Readonly<
    AcceptedActionOutput<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ErrorType
    >
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
