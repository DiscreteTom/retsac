import type { Grammar } from "./grammar";

/**
 * Return whether `anotherRule` starts with the `reducerRule`.
 */
export function ruleStartsWith(
  anotherRule: readonly Grammar[],
  reducerRule: readonly Grammar[]
) {
  if (reducerRule.length > anotherRule.length) return false;
  for (let i = 0; i < reducerRule.length; i++) {
    if (!reducerRule[i].equalWithoutName(anotherRule[i])) return false;
  }
  return true;
}

/**
 * Return whether `reducerRule` ends with `anotherRule`.
 */
export function ruleEndsWith(
  reducerRule: readonly Grammar[],
  anotherRule: readonly Grammar[]
) {
  if (reducerRule.length < anotherRule.length) return false;
  for (let i = 0; i < anotherRule.length; i++) {
    if (!reducerRule.at(-i - 1)!.equalWithoutName(anotherRule.at(-i - 1)!))
      return false;
  }
  return true;
}
