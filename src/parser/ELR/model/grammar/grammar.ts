import { ASTNode } from "../../../ast";
import { StringCache, Cache } from "../../../cache";

// type only import for js doc
import type { GrammarRepo } from "./grammar-repo";
import type { Candidate } from "../../DFA/candidate";
import type { State } from "../../DFA/state";

export enum GrammarType {
  /**
   * Terminator, which means the grammar's kind name should be defined in lexer.
   */
  T,
  /**
   * Non-terminator, which means the grammar's kind name should be defined in parser.
   */
  NT,
}

export class Grammar {
  readonly type: GrammarType;
  /**
   * The kind name.
   */
  readonly kind: string;
  /**
   * The literal value if this is a T and require the text to match, without quote.
   * @default undefined
   */
  readonly text?: string;
  /**
   * The name of the grammar.
   * By default it's the same as the {@link Grammar.kind kind} name.
   */
  readonly name: string;

  /**
   * @see {@link Grammar.toString}
   */
  readonly str: StringCache;
  /**
   * @see {@link Grammar.getCacheKeyWithoutName}
   */
  // TODO: rename this to some `nodeMatcher`?
  readonly cacheKeyWithoutName: StringCache;
  /**
   * @see {@link ASTNode.strWithName}
   */
  readonly strWithName: StringCache;
  /**
   * @see {@link ASTNode.strWithoutName}
   */
  readonly strWithoutName: StringCache;
  /**
   * @see {@link Grammar.getGrammarStrWithName}
   */
  readonly grammarStrWithName: string;
  /**
   * @see {@link Grammar.getGrammarStrWithoutName}
   */
  readonly grammarStrWithoutName: StringCache;
  /**
   * This is used when calculate all DFA state.
   */
  readonly mockNode: Cache<Readonly<ASTNode<any, any>>>;

  /**
   * Only {@link GrammarRepo} should use this constructor.
   */
  constructor(
    p: Pick<Grammar, "type" | "kind" | "name" | "text"> & {
      /**
       * Reuse this generated by {@link GrammarRepo}.
       */
      grammarStrWithName: string;
    }
  ) {
    this.type = p.type;
    this.kind = p.kind;
    this.name = p.name;
    this.text = p.text;

    this.str = new StringCache(
      () =>
        `Grammar({ type: "${GrammarType[this.type]}", kind: "${
          this.kind
        }", name: "${this.name}", text: ${JSON.stringify(this.text)} })` // quote text, escape literal
    );
    this.cacheKeyWithoutName = new StringCache(() =>
      Grammar.getCacheKeyWithoutName(this)
    );
    this.strWithName = new StringCache(() => ASTNode.getStrWithName(this));
    this.strWithoutName = new StringCache(() =>
      ASTNode.getStrWithoutName(this)
    );
    this.grammarStrWithName = p.grammarStrWithName;
    this.grammarStrWithoutName = new StringCache(() =>
      Grammar.getGrammarStrWithoutName(this)
    );
    this.mockNode = new Cache(
      () =>
        new ASTNode({
          kind: this.kind,
          text: this.text,
          start: 0,
          // don't set name, since the name is set by the parent node
        })
    );
  }

  /**
   * This is used in conflict detection, so we don't need to check the name.
   * This is required because some grammar's names are different, but the kind & text are the same.
   */
  equalWithoutName(g: Readonly<Grammar>) {
    return (
      this == g || // same object
      (this.type == g.type && this.kind == g.kind && this.text == g.text)
    );
  }

  /**
   * For debug output.
   */
  toString() {
    return this.str.value;
  }

  /**
   * A unique key for cache.
   * This is used in {@link Candidate.getNext} and {@link State.getNext}.
   */
  static getCacheKeyWithoutName(data: Pick<Grammar, "kind" | "text">): string {
    // when current is literal, in Grammar.match we will check the kind and text
    // so we need to use both kind and text to calculate cache key
    if (data.text != undefined) {
      return `${data.kind}:${data.text}`;
    }

    // else, if this is NT, we only need the kind name as the cache.
    // if this is a T without
    return data.kind;
  }
  /**
   * Format: `kind@name` if not literal, else `"text"@name`.
   * This is used to generate grammar rule string with name.
   */
  static getGrammarStrWithName(data: Pick<Grammar, "kind" | "name" | "text">) {
    return (
      (data.text != undefined
        ? JSON.stringify(data.text) // quote text, escape literal
        : data.kind) + (data.name == data.kind ? "" : "@" + data.name)
    );
  }

  /**
   * Format: `kind` if not literal, else `"text"`.
   */
  static getGrammarStrWithoutName(data: Pick<Grammar, "kind" | "text">) {
    return data.text != undefined
      ? JSON.stringify(data.text) // quote text, escape literal
      : data.kind;
  }

  toJSON() {
    return {
      type: this.type,
      kind: this.kind,
      name: this.name,
      text: this.text,
      str: this.str.value,
      cacheKeyWithoutName: this.cacheKeyWithoutName.value,
      strWithName: this.strWithName.value,
      strWithoutName: this.strWithoutName.value,
      grammarStrWithName: this.grammarStrWithName,
      grammarStrWithoutName: this.grammarStrWithoutName.value,
    };
  }

  static fromJSON(data: ReturnType<Grammar["toJSON"]>) {
    const g = new Grammar({
      type: data.type,
      kind: data.kind,
      name: data.name,
      text: data.text,
      grammarStrWithName: data.grammarStrWithName,
    });
    g.str.value = data.str;
    g.cacheKeyWithoutName.value = data.cacheKeyWithoutName;
    g.strWithName.value = data.strWithName;
    g.strWithoutName.value = data.strWithoutName;
    g.grammarStrWithoutName.value = data.grammarStrWithoutName;
    return g;
  }
}
