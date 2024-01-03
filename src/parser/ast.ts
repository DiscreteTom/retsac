import type { ExtractKinds, GeneralToken } from "../lexer";
import {
  type ASTNodeFirstMatchChildSelector,
  type ASTNodeChildrenSelector,
  type ASTNodeSelector,
  type ASTNodeFirstMatchSelector,
} from "./selector";
import { InvalidTraverseError } from "./error";
import type { Traverser } from "./traverser";
import { defaultTraverser } from "./traverser";
import { anonymousKindPlaceholder } from "../anonymous";
import type { StringOrLiteral } from "../helper";

/**
 * A structured type for serialization.
 * Every field is not null/undefined.
 */
export type ASTObj = {
  /**
   * By default, this is the same as the kind name.
   * You can rename nodes in your grammar rules.
   */
  name: string;
  /**
   * T's or NT's kind name.
   * If the T is anonymous, the value is an empty string.
   */
  kind: string;
  /**
   * Start position of the whole input string.
   * Same as the first token's start position.
   */
  start: number;
  /**
   * T's text content.
   * If this is not a T, the value is an empty string.
   */
  text: string;
  /**
   * NT's children.
   * If this is not an NT, the value is an empty array.
   */
  children: ASTObj[];
};

// TODO: add TraverseContext as a generic type parameter
export abstract class ASTNode<
  Kind extends NTs | ExtractKinds<TokenType>, // the kind name of this node
  NTs extends string, // all NTs' kind names
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> {
  /**
   * T's or NT's kind name.
   */
  readonly kind: Kind;
  /**
   * By default, this is the same as the kind name.
   * You can rename nodes in your grammar rules.
   */
  name: string;
  /**
   * Start position of the whole input string.
   * Same as the first token's start position.
   */
  readonly start: number;
  /**
   * @default undefined
   */
  data?: ASTData;
  /**
   * @default undefined
   */
  error?: ErrorType;

  // should only be used by subclasses
  protected constructor(
    p: Pick<
      ASTNode<Kind, NTs, ASTData, ErrorType, TokenType>,
      "kind" | "start" | "data" | "error"
    >,
  ) {
    // name will be set when the parent node is created
    // so in constructor, we should use the default name
    this.name = p.kind;

    this.kind = p.kind;
    this.start = p.start;
    this.data = p.data;
    this.error = p.error;
  }

  /**
   * Return a tree-structured string.
   */
  toTreeString(options?: {
    /**
     * The indent for each level.
     * @default '  ' // two spaces
     */
    indent?: string;
    /**
     * Anonymous kind name placeholder.
     * @default "<anonymous>" // anonymousKindPlaceholder
     */
    anonymous?: string;
  }): string {
    return this._toTreeString({
      initial: "",
      indent: options?.indent ?? "  ",
      anonymous: options?.anonymous ?? anonymousKindPlaceholder,
    });
  }

  /**
   * `toTreeString` with full options.
   */
  abstract _toTreeString(options: {
    /**
     * The initial indent.
     */
    initial: string;
    /**
     * The indent for each level.
     */
    indent: string;
    /**
     * Anonymous kind name placeholder.
     */
    anonymous: string;
  }): string;

  /**
   * For debug output.
   */
  abstract toString(): string;

  /**
   * Return an ASTObj for serialization.
   */
  abstract toJSON(): ASTObj;

  /**
   * A type guard for checking the kind of this node.
   */
  is<TargetKind extends Kind>(
    kind: TargetKind,
  ): this is ASTNode<TargetKind, NTs, ASTData, ErrorType, TokenType> {
    return this.kind === kind;
  }
}

export class NTNode<
  Kind extends NTs, // the kind name of this node
  NTs extends string, // all NTs' kind names
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> extends ASTNode<Kind, NTs, ASTData, ErrorType, TokenType> {
  readonly children: readonly ASTNode<
    NTs | ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType
  >[];
  /**
   * Select the first matched child node by the name.
   */
  readonly $: ASTNodeFirstMatchChildSelector<
    NTs,
    ASTData,
    ErrorType,
    TokenType
  >;
  /**
   * Select children nodes by the name.
   */
  readonly $$: ASTNodeChildrenSelector<NTs, ASTData, ErrorType, TokenType>;

  /**
   * `traverser` shouldn't be exposed
   * because we want users to use `traverse` instead of `traverser` directly.
   * Make this private to prevent users from using it by mistake.
   *
   * Only NT node has traverser, since T node is created by token.
   */
  private traverser: Traverser<Kind, ASTData, ErrorType, TokenType>;

  constructor(
    p: Pick<
      NTNode<Kind, NTs, ASTData, ErrorType, TokenType>,
      "kind" | "start" | "data" | "error" | "children"
    > & {
      traverser?: Traverser<Kind, ASTData, ErrorType, TokenType>;
      firstMatchSelector: ASTNodeFirstMatchSelector<
        NTs,
        ASTData,
        ErrorType,
        TokenType
      >;
      selector: ASTNodeSelector<NTs, ASTData, ErrorType, TokenType>;
    },
  ) {
    super(p);
    this.children = p.children;
    this.traverser = p.traverser ?? defaultTraverser;
    this.$ = <
      TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>,
    >(
      name: TargetKind,
    ) => p.firstMatchSelector(name, this.children);
    this.$$ = <
      TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>,
    >(
      name: TargetKind,
    ) => p.selector(name, this.children);
  }

  toString(): string {
    return `ASTNode(${JSON.stringify({
      name: this.name,
      kind: this.kind,
      start: this.start,
      children: this.children.map((c) => c.name),
      // data and error might not able to be serialized
    })})`;
  }

  // _toTreeString(indent: string): string {
  //   const kind = this.kind === "" ? anonymousKindPlaceholder : this.kind;
  //   let res = `${indent}${
  //     this.kind === this.name ? kind : `${kind}@${this.name}`
  //   }: `;
  //   if (this.text) res += JSON.stringify(this.text); // quote the text
  //   res += "\n";
  //   this.children?.forEach((c) => {
  //     res += c.toTreeString({
  //       indent: indent + "  ",
  //     });
  //   });
  //   return res;
  // }

  _toTreeString(options: {
    initial: string;
    indent: string;
    anonymous: string;
  }): string {
    const kind = this.kind === "" ? options.anonymous : this.kind;

    return `${options.initial}${
      this.kind === this.name ? kind : `${kind}@${this.name}`
    }: \n${this.children
      .map((c) =>
        c._toTreeString({
          initial: options.initial + options.indent,
          indent: options.indent,
          anonymous: options.anonymous,
        }),
      )
      .join("")}`;
  }

  toJSON(): ASTObj {
    return {
      name: this.name,
      kind: this.kind,
      start: this.start,
      text: "",
      children: this.children.map((c) => c.toJSON()),
    };
  }

  /**
   * Use the traverser to calculate data and return the data.
   *
   * @throws {InvalidTraverseError} if the node is a leaf node (no children).
   */
  // TODO: add a parameter as the traverse context
  traverse(): ASTData | undefined {
    if (this.children === undefined) throw new InvalidTraverseError(this);
    const res = this.traverser(
      this as Parameters<Traverser<Kind, ASTData, ErrorType, TokenType>>[0], // children is not undefined
    );
    this.data =
      res ??
      (res === null
        ? (null as ASTData)
        : // undefined or void
          undefined);
    return this.data;
  }
}

export class TNode<
  Kind extends ExtractKinds<TokenType>, // the kind name of this node
  NTs extends string, // all NTs' kind names
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> extends ASTNode<Kind, NTs, ASTData, ErrorType, TokenType> {
  /**
   * Parent must be an NT node, or `undefined` if this node is a top level node.
   * This is not readonly because it will be set by parent node.
   */
  parent?: NTNode<NTs, NTs, ASTData, ErrorType, TokenType>;
  token: TokenType & { kind: Kind };

  /**
   * Token's text content.
   */
  get text() {
    return this.token.content;
  }

  constructor(
    p: Pick<
      TNode<Kind, NTs, ASTData, ErrorType, TokenType>,
      "kind" | "start" | "data" | "error" | "parent" | "token"
    >,
  ) {
    super(p);
    this.parent = p.parent;
    this.token = p.token;
  }

  static from<
    NTs extends string,
    ASTData,
    ErrorType,
    TokenType extends GeneralToken,
  >(t: Readonly<TokenType>) {
    return new TNode<
      ExtractKinds<TokenType>,
      NTs,
      ASTData,
      ErrorType,
      TokenType
    >({
      kind: t.kind,
      start: t.start,
      token: t,
    });
  }

  toString(): string {
    return `ASTNode(${JSON.stringify({
      name: this.name,
      kind: this.kind,
      start: this.start,
      text: this.text,
      // data and error might not able to be serialized
    })})`;
  }

  _toTreeString(options: {
    initial: string;
    indent: string;
    anonymous: string;
  }): string {
    const kind = this.kind.length === 0 ? options.anonymous : this.kind;

    return `${options.initial}${
      this.kind === this.name ? kind : `${kind}@${this.name}`
    }: ${JSON.stringify(this.text)}\n`;
  }

  toJSON(): ASTObj {
    return {
      name: this.name,
      kind: this.kind,
      start: this.start,
      text: this.text,
      children: [],
    };
  }
}
