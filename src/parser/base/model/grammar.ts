import { ILexer } from "../../../lexer/model";
import { ASTNode } from "../../ast";
import { LR_RuntimeError } from "../error";
import { BaseParserContext, Callback, Rejecter } from "./context";
import { ruleEndsWith, ruleStartsWith } from "./util";

export enum GrammarType {
  /** Literal string. */
  LITERAL,
  /** Terminator. */
  T,
  /** Non-terminator. */
  NT,
}

export class Grammar {
  type: GrammarType;
  /** Literal content, or T/NT's type name. */
  content: string;

  constructor(p: Pick<Grammar, "type" | "content">) {
    Object.assign(this, p);
  }

  /** Equals to. */
  eq<_>(g: Readonly<Grammar> | Readonly<ASTNode<_>>) {
    if (g instanceof Grammar)
      return this.type == g.type && this.content == g.content;
    else if (g instanceof ASTNode)
      return this.type == GrammarType.LITERAL
        ? // check literal content
          this.content == g.text
        : // check type name
          this.content == g.type;
  }

  toASTNode<T>(lexer?: ILexer) {
    if (this.type == GrammarType.LITERAL) {
      if (!lexer) throw LR_RuntimeError.missingLexerToParseLiteral();
      return new ASTNode<T>({
        type: lexer.dryClone().lex(this.content)!.type,
        text: this.content,
        start: 0,
      });
    } else return new ASTNode<T>({ type: this.content, start: 0 });
  }

  /** Return `type name` or `"literal"` */
  toString() {
    return this.type == GrammarType.LITERAL
      ? // literal content
        `'${this.content}'`
      : // type name
        this.content;
  }
}

export class GrammarRule<T, After, Ctx extends BaseParserContext<T, After>> {
  rule: Grammar[];
  /** The reduce target. */
  NT: string;
  callback: Callback<T, After, Ctx>;
  rejecter: Rejecter<T, After, Ctx>;

  constructor(
    p: Partial<Pick<GrammarRule<T, After, Ctx>, "callback" | "rejecter">> &
      Pick<GrammarRule<T, After, Ctx>, "rule" | "NT">
  ) {
    p.callback ??= () => {};
    p.rejecter ??= () => false;

    // parser builder will ensure every rule has at least one grammar.
    // we don't need to check it here.
    // if (!p.rule.length) throw ParserError.emptyRule(p.NT);

    Object.assign(this, p);
  }

  /**
   * Check if the tail of this's rule is the same as the head of another.
   * Which means this rule want's to reduce, and another rule want's to shift.
   */
  checkRSConflict(another: Readonly<GrammarRule<T, After, Ctx>>) {
    const result = [] as {
      reducerRule: GrammarRule<T, After, Ctx>;
      shifterRule: GrammarRule<T, After, Ctx>;
      /** How many grammars are overlapped in rule. */
      length: number;
    }[];
    for (let i = 0; i < this.rule.length; ++i) {
      if (
        ruleStartsWith(another.rule, this.rule.slice(i)) &&
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
  checkRRConflict(another: Readonly<GrammarRule<T, After, Ctx>>) {
    return ruleEndsWith(this.rule, another.rule);
  }

  /** Return ``{ NT: `grammar rules` }``. */
  toString(formatter?: (NT: string, grammars: string[]) => string) {
    formatter ??= (NT, grammars) => `{ ${NT}: \`${grammars.join(" ")}\` }`;

    return formatter(
      this.NT,
      this.rule.map((g) => g.toString())
    );
  }
}

/** A set of different grammars. */
export class GrammarSet /* implements Iterable<Grammar> */ {
  /** Grammars. */
  private gs: Grammar[];

  constructor() {
    this.gs = [];
  }

  // [Symbol.iterator](): Iterator<Grammar, any, undefined> {
  //   return this.gs[Symbol.iterator]();
  // }

  has<_>(g: Readonly<Grammar> | Readonly<ASTNode<_>>) {
    return !this.gs.every((gg) => !gg.eq(g));
  }

  /** Return `true` if successfully added. */
  add(g: Grammar) {
    if (this.has(g)) return false;
    this.gs.push(g);
    return true;
  }

  map<R>(f: (g: Grammar) => R) {
    return this.gs.map(f);
  }

  /** Return a list of grammars that in both `this` and `gs`. */
  overlap(gs: Readonly<GrammarSet>) {
    return this.gs.filter((g) => gs.has(g));
  }
}
