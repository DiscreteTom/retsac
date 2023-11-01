import { CaretNotAllowedError } from "../error";

/**
 * Make sure the regex has the flag `y`/`g` so we can use `r.lastIndex` to reset state.
 * If not, set the flag `y` to the regex.
 */
export function makeRegexAutoSticky(r: RegExp) {
  return !r.sticky && !r.global ? new RegExp(r.source, r.flags + "y") : r;
}

/**
 * Make sure the regex has the flag `y`/`g` so we can use `r.lastIndex` to reset state.
 * If not, set the flag `g` to the regex.
 */
export function makeRegexAutoGlobal(r: RegExp) {
  return !r.sticky && !r.global ? new RegExp(r.source, r.flags + "g") : r;
}

/**
 * Make sure the regex does not start with `^` so the `r.lastIndex` will take effect.
 * If not, throw an error.
 */
export function checkRegexNotStartsWithCaret(r: RegExp) {
  if (r.source.startsWith("^")) throw new CaretNotAllowedError();
}
