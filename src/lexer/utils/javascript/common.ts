import type { Action } from "../../action";
import { comment as commonComment } from "../common";

/**
 * Return an action that matches JavaScript comments (single line and multi line).
 */
export function comment<ActionState = never, ErrorType = never>(): Action<
  { kind: never; data: undefined },
  ActionState,
  ErrorType
> {
  return commonComment<ActionState, ErrorType>("//").or(
    commonComment("/*", "*/"),
  );
}
