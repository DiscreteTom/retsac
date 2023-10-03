export function notNullFilter<T>(value: T | null): value is T {
  return value !== null;
}
export function notUndefinedFilter<T>(value: T | undefined): value is T {
  return value !== undefined;
}

// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
export function hashStringToNum(s: string) {
  return s.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
}
