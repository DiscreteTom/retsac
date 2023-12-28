// TODO: move to a helper folder

/**
 * Try to execute a function and return the result or a default value if an error is thrown.
 */
export function tryOrDefault<R>(f: () => R, defaultValue: R) {
  try {
    return f();
  } catch {
    return defaultValue;
  }
}

/**
 * Try to execute a function and return the result or `undefined` if an error is thrown.
 */
export function tryOrUndefined<R>(f: () => R) {
  return tryOrDefault(f, undefined);
}
