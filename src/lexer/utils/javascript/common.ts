import { rejectedActionOutput, Action } from "../../action";
import { comment as commonComment } from "../common";
import { charSize, isIdentifierPart, isIdentifierStart } from "./utils";

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

/**
 * Return an action that matches JavaScript identifier.
 *
 * Unicode escape sequence is not supported.
 */
export function identifier<ActionState = never, ErrorType = never>() {
  // ref: https://github.com/microsoft/TypeScript/blob/efc9c065a2caa52c5bebd08d730eed508075a78a/src/compiler/scanner.ts#L2327
  return Action.exec<undefined, ActionState, ErrorType>((input) => {
    const text = input.buffer;
    const end = text.length;
    let pos = input.start;
    let ch = text.charCodeAt(pos);

    if (!isIdentifierStart(ch)) return rejectedActionOutput;

    pos += charSize(ch);

    while (pos < end && isIdentifierPart((ch = text.codePointAt(pos)!)))
      pos += charSize(ch);

    return {
      accept: true,
      content: input.buffer.slice(input.start, pos),
      digested: pos - input.start,
      muted: false,
      data: undefined,
    };
  });
}
