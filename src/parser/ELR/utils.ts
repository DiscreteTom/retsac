export function nonNullFilter<T>(value: T | null): value is T {
  return value !== null;
}
