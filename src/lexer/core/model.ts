import type { AnonymousKindPlaceholder } from "../../anonymous";
import type { ReadonlyAction, ActionOutput } from "../action";
import type {
  GeneralTokenDataBinding,
  ExtractKinds,
  ExtractData,
} from "../model";

/**
 * Validator is used to check if an action can be skipped before executing it,
 * and if an action's output can be accepted after executing it.
 */
export type Validator<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> = {
  /**
   * Check if an action can be skipped before executing it.
   */
  skipBeforeExec: (
    action: ReadonlyAction<DataBindings, ActionState, ErrorType>,
  ) => {
    skip: boolean;
    skippedActionMessageFormatter: (info: {
      kinds: (AnonymousKindPlaceholder | ExtractKinds<DataBindings>)[];
    }) => string;
  };
  acceptAfterExec: (
    output: ActionOutput<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ErrorType
    >,
  ) => {
    accept: boolean;
    acceptMessageFormatter: (info: {
      kind: AnonymousKindPlaceholder | ExtractKinds<DataBindings>;
      muted: boolean;
      /**
       * The content of the token.
       */
      content: string;
    }) => string;
  };
};
