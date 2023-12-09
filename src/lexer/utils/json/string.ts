import type { EscapeHandler } from "../string";
import { stringLiteral as commonStringLiteral } from "../string";
import { fallback, map, unicode } from "../string/handler";

export const escapeHandlers = {
  simple(): EscapeHandler<never> {
    // ref: https://www.json.org/json-en.html
    return map({
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
    });
  },
};

export function stringLiteral<ActionState = never, ErrorType = never>() {
  return commonStringLiteral<"unicode" | "unnecessary", ActionState, ErrorType>(
    `"`,
    {
      escape: {
        handlers: [
          escapeHandlers.simple(),
          unicode({ error: "unicode" }),
          // keep the fallback handler at the end for error handling
          fallback({ error: "unnecessary" }),
        ],
      },
    },
  );
}
