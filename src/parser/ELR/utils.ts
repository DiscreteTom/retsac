export function notNullFilter<T>(value: T | null): value is T {
  return value !== null;
}
export function notUndefinedFilter<T>(value: T | undefined): value is T {
  return value !== undefined;
}
