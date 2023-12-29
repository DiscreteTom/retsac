import type { AcceptedActionDecoratorContext } from "../action";

/**
 * Reject the action if the `output.data.invalid` is not `undefined`.
 */
export function invalidRejecter<
  DataBindings extends { kind: string; data: { invalid?: unknown } },
  ActionState,
  ErrorType,
>({
  input: _,
  output,
}: AcceptedActionDecoratorContext<
  DataBindings,
  ActionState,
  ErrorType
>): boolean {
  return output.data.invalid !== undefined;
}
