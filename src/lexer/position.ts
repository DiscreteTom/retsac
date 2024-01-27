import type { Range } from "./model";

export type Position = {
  /**
   * 1-based line number.
   */
  line: number;
  /**
   * 1-based column number.
   */
  column: number;
};

export class PositionTransformer {
  private _lineRanges: Range[];

  constructor(buffer?: string) {
    this._lineRanges = [{ start: 0, end: 0 }];
    if (buffer !== undefined) this.update(buffer);
  }

  get lineRanges() {
    return this._lineRanges as readonly Readonly<Range>[];
  }

  update(append: string) {
    const currentLineRange = this._lineRanges.pop()!;

    // in js split is faster than iterating over the string
    append.split("\n").forEach((line, i, arr) => {
      currentLineRange.end += line.length + (i === arr.length - 1 ? 0 : 1); // 1 for the \n
      this._lineRanges.push({ ...currentLineRange }); // make a copy
      currentLineRange.start = currentLineRange.end;
    });
  }

  /**
   * Transform 0-based index to 1-based line and column.
   * Return `undefined` if the index is out of range.
   */
  transform(index: number) {
    // out of range
    if (index < 0 || index >= this._lineRanges.at(-1)!.end) return undefined;

    const lineIndex = binarySearch(this._lineRanges, index, (a, b) =>
      a < b.start ? -1 : a >= b.end ? 1 : 0,
    );
    if (lineIndex < 0) return undefined;

    return {
      line: lineIndex + 1,
      column: index - this._lineRanges[lineIndex].start + 1,
    };
  }
}

// https://stackoverflow.com/questions/22697936/binary-search-in-javascript
function binarySearch<E, T>(
  arr: readonly E[],
  el: T,
  compare_fn: (a: T, b: E) => number,
) {
  let m = 0;
  let n = arr.length - 1;
  while (m <= n) {
    const k = (n + m) >> 1;
    const cmp = compare_fn(el, arr[k]);
    if (cmp > 0) {
      m = k + 1;
    } else if (cmp < 0) {
      n = k - 1;
    } else {
      return k;
    }
  }
  return ~m;
}
