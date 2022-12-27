import {
  Grammar,
  GrammarCallback,
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
  callback?: GrammarCallback<T>;
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

export interface Definition {
  [NT: string]: string | string[];
}

export enum ConflictType {
  SHIFT_REDUCE,
  REDUCE_REDUCE,
}

export interface ResolvedConflict {
  type: ConflictType;
  rule1: TempGrammarRule<void>;
  rule2: TempGrammarRule<void>;
}
