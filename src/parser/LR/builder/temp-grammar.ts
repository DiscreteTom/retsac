import {
  Grammar,
  Callback,
  GrammarRule,
  GrammarType,
  Rejecter,
} from "../model";

/** Grammar type, but can't distinguish N or NT. */
export enum TempGrammarType {
  LITERAL,
  /** T or NT */
  GRAMMAR,
}

/** Grammar, but can't distinguish N or NT. */
export class TempGrammar {
  type: TempGrammarType;
  /** Literal content, or T/NT's type name. */
  content: string;

  constructor(p: Pick<TempGrammar, "type" | "content">) {
    Object.assign(this, p);
  }

  static from(g: Grammar) {
    return new TempGrammar({
      type:
        g.type == GrammarType.LITERAL
          ? TempGrammarType.LITERAL
          : TempGrammarType.GRAMMAR,
      content: g.content,
    });
  }

  eq(g: TempGrammar) {
    return this.type == g.type && this.content == g.content;
  }

  toGrammar(isT = true) {
    return new Grammar({
      type:
        this.type == TempGrammarType.LITERAL
          ? GrammarType.LITERAL
          : isT
          ? GrammarType.T
          : GrammarType.NT,
      content: this.content,
    });
  }
}

/** Grammar rule, but can't distinguish N or NT. */
export class TempGrammarRule<T> {
  rule: TempGrammar[];
  /** The reduce target. */
  NT: string;
  callback?: Callback<T>;
  rejecter?: Rejecter<T>;

  constructor(
    data: Partial<TempGrammarRule<T>> & Pick<TempGrammarRule<T>, "rule" | "NT">
  ) {
    Object.assign(this, data);
  }

  /** Only check whether NT and rules are equal. */
  weakEq<_>(rule: TempGrammarRule<_>) {
    return (
      this.NT == rule.NT &&
      this.rule.length == rule.rule.length &&
      this.rule.every((g, i) => g.eq(rule.rule[i]))
    );
  }

  /** Return whether this.rule starts with another rule. */
  private ruleStartsWith(anotherRule: TempGrammar[]) {
    if (this.rule.length < anotherRule.length) return false;
    for (let i = 0; i < anotherRule.length; i++) {
      if (this.rule[i].eq(anotherRule[i])) return false;
    }
    return true;
  }

  /** Return whether this.rule ends with `partialRule`. */
  private ruleEndsWith(anotherRule: TempGrammar[]) {
    if (this.rule.length < anotherRule.length) return false;
    for (let i = 0; i < anotherRule.length; i++) {
      if (this.rule.at(-i - 1)!.eq(anotherRule.at(-i - 1)!)) return false;
    }
    return true;
  }

  /**
   * Check if the tail of this's rule is the same as the head of another.
   * Which means this rule want's to reduce, and another rule want's to shift.
   */
  checkRSConflict(another: TempGrammarRule<T>) {
    const result = [] as {
      reducerRule: TempGrammarRule<T>;
      shifterRule: TempGrammarRule<T>;
      /** How many grammars are overlapped in rule. */
      length: number;
    }[];
    for (let i = 0; i < this.rule.length; ++i) {
      if (
        another.ruleStartsWith(this.rule.slice(i)) &&
        // if the tail of this rule is the same as another's whole rule, it's a reduce-reduce conflict.
        // e.g. `A B C | B C`
        this.rule.length - i != another.rule.length
      ) {
        result.push({
          reducerRule: this,
          shifterRule: another,
          length: this.rule.length - i,
        });
      }
    }
    return result;
  }

  /** Check if the tail of this's rule is the same as another's whole rule. */
  checkRRConflict(another: TempGrammarRule<T>) {
    return this.ruleEndsWith(another.rule);
  }

  toString(formatter?: (NT: string, grammars: string[]) => string) {
    return new GrammarRule<void>({
      NT: this.NT,
      rule: this.rule.map((g) => g.toGrammar()),
    }).toString(formatter);
  }
}
