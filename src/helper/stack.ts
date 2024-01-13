export class Stack<T> {
  private items: T[];

  constructor(items?: T[]) {
    this.items = items ?? [];
  }

  get length() {
    return this.items.length;
  }

  push(item: T) {
    this.items.push(item);
  }

  pop() {
    return this.items.pop();
  }

  get current() {
    return this.items.at(-1);
  }

  clear() {
    this.items = [];
  }

  clone() {
    const stack = new Stack(this.items.slice());
    return stack;
  }
}
