/**
 * Only calculate the value when it's needed.
 */
export class Lazy<Value> {
  private _value?: Value;
  readonly factory: () => Value;

  constructor(factory: () => Value, value?: Value) {
    this.factory = factory;
    this._value = value;
  }

  /**
   * If the value is not calculated yet (the raw value is `undefined`), calculate it and cache it.
   */
  get value() {
    return this._value === undefined
      ? (this._value = this.factory())
      : this._value;
  }

  set value(value: Value) {
    this._value = value;
  }

  /**
   * Get the raw value without calculating it.
   */
  get raw() {
    return this._value;
  }

  /**
   * Reset the cached value to `undefined`.
   */
  reset() {
    this._value = undefined;
  }
}

/**
 * Only calculate the string when it's needed.
 */
export class LazyString extends Lazy<string> {}
