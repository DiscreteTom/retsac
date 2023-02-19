import { ASTNode } from "../../../ast";
import {
  Grammar,
  Callback,
  GrammarRule,
  GrammarType,
  Condition,
} from "../../model";

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

  static from(g: Readonly<Grammar>) {
    return new TempGrammar({
      type:
        g.type == GrammarType.LITERAL
          ? TempGrammarType.LITERAL
          : TempGrammarType.GRAMMAR,
      content: g.content,
    });
  }

  eq<_>(g: Readonly<TempGrammar> | Readonly<ASTNode<_>> | Readonly<Grammar>) {
    if (g instanceof TempGrammar)
      return this.type == g.type && this.content == g.content;
    else if (g instanceof ASTNode)
      return this.type == TempGrammarType.LITERAL
        ? // check literal content
          this.content == g.text
        : // check type name
          this.content == g.type;
    else if (g instanceof Grammar)
      return (
        (this.type == TempGrammarType.LITERAL) ==
          (g.type == GrammarType.LITERAL) && this.content == g.content
      );
  }

  toGrammar(isNT = true) {
    return new Grammar({
      type:
        this.type == TempGrammarType.LITERAL
          ? GrammarType.LITERAL
          : isNT
          ? GrammarType.NT
          : GrammarType.T,
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
  rejecter?: Condition<T>;
  rollback?: Callback<T>;
  commit?: Condition<T>;

  constructor(
    data: Partial<
      Pick<TempGrammarRule<T>, "callback" | "rejecter" | "rollback">
    > &
      Pick<TempGrammarRule<T>, "rule" | "NT" | "commit">
  ) {
    Object.assign(this, data);
  }

  /** Only check whether NT and rules are equal. */
  weakEq<T>(rule: Readonly<TempGrammarRule<T>> | Readonly<GrammarRule<T>>) {
    return (
      this.NT == rule.NT &&
      this.rule.length == rule.rule.length &&
      this.rule.every((g, i) => g.eq(rule.rule[i]))
    );
  }

  toString(formatter?: (NT: string, grammars: string[]) => string) {
    return GrammarRule.getString(
      {
        NT: this.NT,
        rule: this.rule.map((g) => g.toGrammar()),
      },
      formatter
    );
  }
}