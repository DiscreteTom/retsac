import { comment as commonComment } from "../common";

/**
 * Return an action that matches JavaScript comments (single line and multi line).
 */
export function comment<ActionState = never, ErrorType = never>() {
  return [
    commonComment<ActionState, ErrorType>("//"),
    commonComment<ActionState, ErrorType>("/*", "*/"),
  ];
}
