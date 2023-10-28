import type { Action } from "../../action";
import { comment as commonComment } from "../common";

/**
 * Return an action that matches JavaScript comments (single line and multi line).
 */
export function comment<
  Data = never,
  ActionState = never,
  ErrorType = never,
>(): Action<Data, ActionState, ErrorType> {
  return commonComment<Data, ActionState, ErrorType>("//").or(
    commonComment("/*", "*/"),
  );
}
