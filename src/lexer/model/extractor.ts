import type { Definition } from "./definition";
import type { GeneralTokenDataBinding } from "./token";

export type ExtractKinds<DataBindings extends GeneralTokenDataBinding> =
  DataBindings["kind"];

export type ExtractData<DataBindings extends GeneralTokenDataBinding> =
  DataBindings["data"];

export type ExtractDefinition<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> = {
  [Kind in ExtractKinds<DataBindings>]: Definition<
    Kind,
    ExtractData<DataBindings & { kind: Kind }>,
    ActionState,
    ErrorType
  >;
}[ExtractKinds<DataBindings>];

export type ExtractAllDefinitions<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> = readonly Readonly<
  ExtractDefinition<DataBindings, ActionState, ErrorType>
>[];
