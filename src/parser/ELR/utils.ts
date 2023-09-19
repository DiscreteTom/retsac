export function notNullFilter<T>(value: T | null): value is T {
  return value !== null;
}
