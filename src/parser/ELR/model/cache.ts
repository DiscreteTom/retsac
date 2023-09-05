export class Cache<ValueType> {
  private _value?: ValueType;
  readonly factory: () => ValueType;

  constructor(factory: () => ValueType, value?: ValueType) {
    this.factory = factory;
    this._value = value;
  }

  get value() {
    return this._value ?? (this._value = this.factory());
  }

  set value(value: ValueType) {
    this._value = value;
  }

  reset() {
    this._value = undefined;
  }
}

export class StringCache extends Cache<string> {
  constructor(factory: () => string, value?: string) {
    super(factory, value);
  }
}
