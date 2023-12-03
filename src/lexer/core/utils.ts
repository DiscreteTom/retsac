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
} from "../model";
import type { Validator } from "./model";
import { anonymousKindPlaceholder } from "./model";

export function executeActions<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
>(
  actions: readonly ReadonlyAction<DataBindings, ActionState, ErrorType>[],
  validatorFactory: (
    input: ActionInput<ActionState>,
  ) => Validator<DataBindings, ActionState, ErrorType>,
  buffer: string,
  start: number,
  peek: boolean,
  initialRest: string | undefined,
  state: ActionState,
  cb: (ctx: {
    // TODO: remove unused params
    output: AcceptedActionOutput<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ErrorType
    >;
    action: ReadonlyAction<DataBindings, ActionState, ErrorType>;
    digested: number;
    rest: string | undefined;
  }) => {
    updateState: boolean;
    stop: boolean;
    token: Token<DataBindings, ErrorType> | null;
  },
  debug: boolean,
  logger: Logger,
  entity: string,
) {
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
    const res = evaluateActions(
      input,
      // IMPORTANT!: we can't only evaluate the definitions which match the expectation kind
      // because some token may be muted, and we need to check the rest of the input
      // TODO: filter actions here, instead of using `before`? but filter will create a new array
      actions,
      validatorFactory(input),
      debug,
      logger,
      entity,
    );

    if (res === undefined) {
      // all definition checked, no accept or muted
      return { token: null, digested, rest: currentRest, errors };
    }

    // TODO: better var name
    const next = cb({ ...res, digested, rest: currentRest });

    // accumulate errors
    if (next.token?.error !== undefined) errors.push(next.token);

    if (next.updateState) {
      digested += res.output.digested;
      currentRest = res.output.rest.raw;
    }

    if (next.stop)
      return { token: next.token, digested, rest: currentRest, errors };

    // else, non-stop, re-loop all actions
  }
}

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
  // TODO: remove kind
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
