// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { GrammarRepo } from "./grammar-repo";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { GrammarSet } from "./grammar-set";

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

// TODO: move to another file? rename to ASTNodeLike?
export type MockNode = { kind: string; text?: string };

/**
 * @see {@link Grammar.grammarString}.
 */
export type GrammarString = string & NonNullable<unknown>; // same as string, but won't be inferred as string literal (new type pattern)
/**
 * @see {@link Grammar.grammarStringNoName}.
 */
export type GrammarStringNoName = string & NonNullable<unknown>; // same as string, but won't be inferred as string literal (new type pattern)

export class Grammar<AllKinds extends string> implements MockNode {
  readonly type: GrammarType;
  /**
   * The kind name.
   */
  readonly kind: AllKinds;
  /**
   * The literal value if this is a T and require the text to match, without quote.
   * @default undefined
   */
  readonly text: string | undefined;
  /**
   * The name of the grammar.
   * By default it's the same as the {@link Grammar.kind kind} name.
   */
  readonly name: string;

  /**
   * Format: `kind` if not literal, else `'text'` (use single quote to reduce the length when `JSON.stringify`).
   *
   * Can be calculated by {@link Grammar.getGrammarStringNoName}.
   *
   * This is used in {@link GrammarSet} to compare grammars without name.
   * This can be used as the unique id for the grammar when the name is not required.
   * This is frequently used so we will pre-calculate it.
   */
  readonly grammarStringNoName: GrammarStringNoName;
  /**
   * Format: `kind@name` if not literal, else `'text'@name` (use single quote to reduce the length when `JSON.stringify`).
   *
   * Can be calculated by {@link Grammar.getGrammarString}.
   *
   * This is used to generate grammar rule string with name.
   * This is used in {@link GrammarRepo} to track all unique grammars.
   * This can be used as the unique id for the grammar when the name is required.
   * This is frequently used so we will pre-calculate it.
   */
  readonly grammarString: GrammarString;

  /**
   * Only {@link GrammarRepo} should use this constructor.
   */
  constructor(
    p: Pick<
      Grammar<AllKinds>,
      | "type"
      | "kind"
      | "name"
      | "text"
      | "grammarStringNoName"
      | "grammarString"
    >,
  ) {
    this.type = p.type;
    this.kind = p.kind;
    this.name = p.name;
    this.text = p.text;

    this.grammarString = p.grammarString;
    this.grammarStringNoName = p.grammarStringNoName;
  }

  /**
   * This is used in conflict detection, so we don't need to check the name.
   * This is required because some grammar's names are different, but the kind & text are the same.
   */
  equalWithoutName(g: Readonly<Grammar<AllKinds>>) {
    return (
      this === g || // same object
      (this.type === g.type && this.kind === g.kind && this.text === g.text)
    );
  }

  /**
   * For debug output.
   *
   * Format: `Grammar({ type, kind, name, text })`.
   */
  toString() {
    return `Grammar(${JSON.stringify({
      type: GrammarType[this.type], // convert to string
      kind: this.kind,
      name: this.name,
      text: this.text,
    })})`;
  }

  /**
   * @see {@link Grammar.grammarStringNoName}
   */
  static getGrammarStringNoName(
    data: Pick<Grammar<string>, "kind" | "text">,
  ): GrammarStringNoName {
    return data.text !== undefined
      ? `'${JSON.stringify(data.text).slice(1, -1)}'` // quote text, escape literal
      : data.kind;
  }

  /**
   * @see {@link Grammar.grammarString}
   */
  static getGrammarString(
    data: Pick<Grammar<string>, "kind" | "name" | "text">,
  ): GrammarString {
    // [[grammar string]]
    return (
      Grammar.getGrammarStringNoName(data) +
      (data.name === data.kind ? "" : "@" + data.name)
    );
  }

  toJSON() {
    return {
      type: this.type,
      kind: this.kind,
      name: this.name,
      text: this.text,
      grammarString: this.grammarString,
      grammarStringNoName: this.grammarStringNoName,
    };
  }

  static fromJSON<AllKinds extends string>(
    data: ReturnType<Grammar<AllKinds>["toJSON"]>,
  ) {
    return new Grammar({
      type: data.type,
      kind: data.kind,
      name: data.name,
      text: data.text,
      grammarString: data.grammarString,
      grammarStringNoName: data.grammarStringNoName,
    });
  }
}
