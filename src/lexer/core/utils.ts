import type { Logger } from "../../logger";
import { rejectedActionOutput } from "../action";
import type {
  AcceptedActionOutput,
  ActionOutput,
  ReadonlyAction,
  ActionInput,
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
 * Find the first action which can accept the input.
 * If no action is accepted, return `undefined`.
 *
 * If the result token is muted, it may not match the expectation's kind/text.
 *
 * Set `expect.muted` to `true` doesn't guarantee the result token is muted.
 */
// TODO: optimize comments
export function evaluateActions<
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
  | {
      output: AcceptedActionOutput<
        ExtractKinds<DataBindings>,
        ExtractData<DataBindings>,
        ErrorType
      >;
      action: ReadonlyAction<DataBindings, ActionState, ErrorType>;
    }
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
    if (output.accept) {
      return { output, action };
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
 * Try to apply the action to the input.
 * Return rejected action output if the action is rejected or not pass the validation.
 */
export function tryExecuteAction<
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
