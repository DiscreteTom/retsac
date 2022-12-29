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
export interface TempGrammar {
  type: TempGrammarType;
  /** Literal content, or T/NT's type name. */
  content: string;
}

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
      this.rule.every(
        (g, i) =>
          g.content == rule.rule[i].content && g.type == rule.rule[i].type
      )
    );
  }

  /** Return whether this.rule starts with partial rule. */
  private ruleStartsWith(partialRule: TempGrammar[]) {
    if (this.rule.length < partialRule.length) return false;
    for (let i = 0; i < partialRule.length; i++) {
      if (
        this.rule[i].content != partialRule[i].content ||
        this.rule[i].type != partialRule[i].type
      )
        return false;
    }
    return true;
  }

  /** Return whether this.rule ends with partial rule. */
  private ruleEndsWith(partialRule: TempGrammar[]) {
    if (this.rule.length < partialRule.length) return false;
    for (let i = 0; i < partialRule.length; i++) {
      if (
        this.rule.at(-i - 1).content != partialRule.at(-i - 1).content ||
        this.rule.at(-i - 1).type != partialRule.at(-i - 1).type
      )
        return false;
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
      length: number;
    }[];
    for (let i = 0; i < this.rule.length; ++i) {
      if (
        another.ruleStartsWith(this.rule.slice(i)) &&
        i != another.rule.length - 1 // if i is the last index, it's a reduce-reduce conflict.
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

  toString() {
    return new GrammarRule<void>({
      NT: this.NT,
      rule: this.rule.map(
        (g) =>
          new Grammar({
            type:
              g.type == TempGrammarType.LITERAL
                ? GrammarType.LITERAL
                : GrammarType.NT,
            content: g.content,
          })
      ),
    }).toString();
  }
}
