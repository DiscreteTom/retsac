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
   * Unique string by the kind, name and text.
   * This is used in {@link GrammarRepo} to track all unique grammars.
   *
   * Can be calculated by {@link Grammar.getIdWithName}.
   *
   * This is frequently used so we will pre-calculate it.
   */
  readonly idWithName: string;
  /**
   * Unique string by the kind and text.
   * This is used in {@link GrammarSet} to compare grammars without name.
   *
   * Can be calculated by {@link Grammar.getIdWithoutName}.
   *
   * This is frequently used so we will pre-calculate it.
   */
  readonly idWithoutName: string;

  /**
   * Only {@link GrammarRepo} should use this constructor.
   */
  constructor(
    p: Pick<
      Grammar<AllKinds>,
      "type" | "kind" | "name" | "text" | "idWithName" | "idWithoutName"
    >,
  ) {
    this.type = p.type;
    this.kind = p.kind;
    this.name = p.name;
    this.text = p.text;

    this.idWithName = p.idWithName;
    this.idWithoutName = p.idWithoutName;
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
   * @see {@link Grammar.idWithoutName}
   */
  static getIdWithoutName(
    data: Pick<Grammar<string>, "kind" | "text">,
  ): string {
    //
    return data.text !== undefined
      ? // text exists, we can use the text content as the id without the kind
        // because same text must have the same kind. // TODO: why?
        // | kind | text | idWithoutName |
        // | ---- | ---- | ------------- |
        // | same | same | same          |
        // | same | diff | diff          |
        // | diff | same | won't happen  |
        // | diff | diff | diff          |
        //
        // use one quote to reduce the length
        // use single quote to prevent escape in json to reduce the length
        `'${data.text}`
      : // else, there is no text, use the kind as the id
        data.kind;
  }

  /**
   * @see {@link Grammar.idWithName}
   */
  static getIdWithName(data: Pick<Grammar<string>, "kind" | "name" | "text">) {
    return (
      // if name is the same as kind, don't include name to reduce the length
      (data.name === data.kind ? "" : data.name + "@") +
      // put name before idWithoutName to prevent there is '@' in the text content
      Grammar.getIdWithoutName(data)
    );
  }

  /**
   * Format: `kind` if not literal, else `"text"`.
   *
   * This is not pre-calculated because it's only used in debug and error output.
   */
  toGrammarStringWithoutName() {
    return this.text !== undefined
      ? JSON.stringify(this.text) // quote text, escape literal
      : this.kind;
  }

  /**
   * Format: `kind@name` if not literal, else `"text"@name`.
   * This is used to generate grammar rule string with name.
   *
   * This is not pre-calculated because it's only used in debug and error output.
   */
  toGrammarStringWithName() {
    return (
      this.toGrammarStringWithoutName() +
      (this.name === this.kind ? "" : "@" + this.name)
    );
  }

  toJSON() {
    return {
      type: this.type,
      kind: this.kind,
      name: this.name,
      text: this.text,
      idWithName: this.idWithName,
      idWithoutName: this.idWithoutName,
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
      idWithName: data.idWithName,
      idWithoutName: data.idWithoutName,
    });
  }
}
