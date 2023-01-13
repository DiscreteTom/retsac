import { Grammar } from "./grammar";

/** Return whether reducerRule starts with another rule. */
export function ruleStartsWith(
  reducerRule: readonly Grammar[],
  anotherRule: readonly Grammar[]
) {
  if (reducerRule.length < anotherRule.length) return false;
  for (let i = 0; i < anotherRule.length; i++) {
    if (!reducerRule[i].eq(anotherRule[i])) return false;
  }
  return true;
}

/** Return whether reducerRule ends with `anotherRule`. */
export function ruleEndsWith(
  reducerRule: readonly Grammar[],
  anotherRule: readonly Grammar[]
) {
  if (reducerRule.length < anotherRule.length) return false;
  for (let i = 0; i < anotherRule.length; i++) {
    if (!reducerRule.at(-i - 1)!.eq(anotherRule.at(-i - 1)!)) return false;
  }
  return true;
}
