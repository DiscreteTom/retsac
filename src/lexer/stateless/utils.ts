import { anonymousKindPlaceholder } from "../../anonymous";
import type { Logger } from "../../logger";
import { ActionInput } from "../action";
import type { ActionOutput, ReadonlyAction } from "../action";
import { Token } from "../model";
import type {
  GeneralTokenDataBinding,
  ExtractKinds,
  ExtractData,
  ILexOutput,
  IToken,
} from "../model";
import type { Validator } from "./model";

/**
 * `OutputHandler` controls the behaviour of `executeActions`
 * when an un-muted action is accepted.
 */
export type OutputHandler = {
  /**
   * If `true`, fields in `LexerCoreLexOutput` (like `digested`) should be updated.
   */
  updateLexOutput: boolean;
  /**
   * If `true`, the `LexerCoreLexOutput` should have a token created by the `ActionOutput`.
   */
  createToken: boolean;
};

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
  initialRest: string | undefined,
  state: ActionState,
  handler: Readonly<OutputHandler>,
  debug: boolean,
  logger: Logger,
  entity: string,
): ILexOutput<IToken<DataBindings, ErrorType>> {
  const res: ILexOutput<IToken<DataBindings, ErrorType>> = {
    token: undefined,
    digested: 0,
    rest: initialRest,
    errors: [],
  };

  while (true) {
    // first, ensure rest is not empty
    // since maybe some token is muted in the last iteration which cause the rest is empty
    if (start + res.digested >= buffer.length) {
      if (debug) {
        logger.log({
          entity,
          message: "no rest",
        });
      }
      return res;
    }

    // all actions will reuse this action input to reuse lazy values
    // so we have to create it outside of the loop
    const input = new ActionInput({
      buffer,
      start: start + res.digested,
      state,
      rest: res.rest,
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
      return res;
    }

    if (output.error !== undefined) {
      // create token and collect errors
      const token = output2token(input, output);
      res.errors.push(token);

      if (output.muted) {
        // don't emit token
        // just update state and continue
        res.digested += output.digested;
        continue;
      }

      // else, not muted, check output handler
      if (handler.updateLexOutput) {
        res.digested += output.digested;
      }
      if (handler.createToken) {
        res.token = token;
      }
      return res;
    } else {
      // else, no error

      if (output.muted) {
        // don't emit token
        // just update state and continue
        res.digested += output.digested;
        continue;
      }

      // else, not muted, check output handler
      if (handler.updateLexOutput) {
        res.digested += output.digested;
      }
      if (handler.createToken) {
        res.token = output2token(input, output);
      }
      return res;
    }

    // unreachable
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
  const preCheckRes = validator.skipBeforeExec(action);
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
  const postCheckRes = validator.acceptAfterExec(output);
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
): IToken<DataBindings, ErrorType> {
  return Token.from(
    output.kind,
    output.data,
    input.buffer,
    {
      start: input.start,
      end: input.start + output.digested,
    },
    output.error,
  ) as IToken<DataBindings, ErrorType>;
}
