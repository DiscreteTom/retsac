import type { GeneralTokenDataBinding } from "./token";

export type ExtractKinds<DataBindings extends GeneralTokenDataBinding> =
  DataBindings["kind"];

export type ExtractData<DataBindings extends GeneralTokenDataBinding> =
  DataBindings["data"];
