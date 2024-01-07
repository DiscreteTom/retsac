import type { ExtractKinds, GeneralToken } from "../lexer";
import {
  type NTNodeFirstMatchChildSelector,
  type NTNodeChildrenSelector,
  type ASTNodeSelector,
  type ASTNodeFirstMatchSelector,
} from "./selector";
import type { NTNodeTraverser } from "./traverser";
import { defaultNTNodeTraverser } from "./traverser";
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

export abstract class ASTNode<
  Kind extends NTs | ExtractKinds<TokenType>, // the kind name of this node
  NTs extends string, // all NTs' kind names
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> {
  /**
   * By default, this is the same as the kind name.
   * You can rename nodes in your grammar rules.
   */
  name: string;
  /**
   * T's or NT's kind name.
   */
  readonly kind: Kind;
  /**
   * Start position of the whole input string.
   * Same as the first token's start position.
   */
  readonly start: number;
  /**
   * @default undefined
   */
  data: ASTData | undefined;
  /**
   * @default undefined
   */
  error: ErrorType | undefined;
  /**
   * Parent must be an NT node, or `undefined` if this node is a top level node.
   * This is not readonly because it will be set by parent node.
   */
  parent?: NTNode<NTs, NTs, ASTData, ErrorType, TokenType, Global>;

  // should only be used by subclasses
  protected constructor(
    p: Pick<
      ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
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
   * Use the traverser to calculate data and return the data.
   */
  abstract traverse(): ASTData | undefined;

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
   * {@link ASTNode.toTreeString} with full options.
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
  ): this is TargetKind extends NTs
    ? NTNode<TargetKind & NTs, NTs, ASTData, ErrorType, TokenType, Global>
    : TNode<
        TargetKind & ExtractKinds<TokenType>,
        NTs,
        ASTData,
        ErrorType,
        TokenType,
        Global
      > {
    return this.kind === kind;
  }

  /**
   * A type guard for checking whether this node is a T node.
   */
  isT(): this is TNode<
    Kind & ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  > {
    return this instanceof TNode; // TODO: is this the fastest way? maybe `'$' in this`?
  }

  /**
   * A type guard for checking whether this node is an NT node.
   */
  isNT(): this is NTNode<
    Kind & NTs,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  > {
    return this instanceof NTNode; // TODO: is this the fastest way? maybe `'$' in this`?
  }

  /**
   * Cast this node to another kind. No type check.
   */
  as<TargetKind extends Kind>(_kind: TargetKind) {
    return this as unknown as TargetKind extends NTs
      ? NTNode<TargetKind & NTs, NTs, ASTData, ErrorType, TokenType, Global>
      : TNode<
          TargetKind & ExtractKinds<TokenType>,
          NTs,
          ASTData,
          ErrorType,
          TokenType,
          Global
        >;
  }

  /**
   * Cast this node to a T node. No type check.
   */
  asT() {
    return this as unknown as TNode<
      Kind & ExtractKinds<TokenType>,
      NTs,
      ASTData,
      ErrorType,
      TokenType,
      Global
    >;
  }

  /**
   * Cast this node to an NT node. No type check.
   */
  asNT() {
    return this as unknown as NTNode<
      Kind & NTs,
      NTs,
      ASTData,
      ErrorType,
      TokenType,
      Global
    >;
  }
}

export class NTNode<
  Kind extends NTs, // the kind name of this node
  NTs extends string, // all NTs' kind names
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> extends ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global> {
  readonly children: readonly ASTNode<
    NTs | ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >[];
  /**
   * Select the first matched child node by the name.
   */
  readonly $: NTNodeFirstMatchChildSelector<
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >;
  /**
   * Select children nodes by the name.
   */
  readonly $$: NTNodeChildrenSelector<
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >;
  /**
   * `traverser` shouldn't be exposed
   * because we want users to use `traverse` instead of `traverser` directly.
   * Make this non-public to prevent users from using it by mistake.
   */
  private traverser: NTNodeTraverser<
    Kind,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >;
  /**
   * Global data, shared by all NT nodes.
   */
  readonly global: Global; // this should be a reference type. make this readonly

  constructor(
    p: Pick<
      NTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
      "kind" | "start" | "data" | "error" | "children" | "global"
    > & {
      traverser:
        | NTNodeTraverser<Kind, NTs, ASTData, ErrorType, TokenType, Global>
        | undefined;
      firstMatchSelector: ASTNodeFirstMatchSelector<
        NTs,
        ASTData,
        ErrorType,
        TokenType,
        Global
      >;
      selector: ASTNodeSelector<NTs, ASTData, ErrorType, TokenType, Global>;
    },
  ) {
    super(p);

    this.children = p.children;
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
    this.traverser = p.traverser ?? defaultNTNodeTraverser;
    this.global = p.global;
  }

  traverse(): ASTData | undefined {
    const res = this.traverser(this);
    this.data =
      res ??
      (res === null
        ? (null as ASTData)
        : // undefined or void
          undefined);
    return this.data;
  }

  toString(): string {
    return `NTNode(${JSON.stringify({
      name: this.name,
      kind: this.kind,
      start: this.start,
      children: this.children.map((c) => c.name),
      // data and error might not able to be serialized
    })})`;
  }

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
}

export class TNode<
  Kind extends ExtractKinds<TokenType>, // the kind name of this node
  NTs extends string, // all NTs' kind names
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> extends ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global> {
  // TODO: remove token, #38
  token: TokenType & { kind: Kind };

  /**
   * Token's text content.
   */
  get text() {
    return this.token.content;
  }

  constructor(
    p: Pick<
      TNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
      "kind" | "start" | "token"
    >,
  ) {
    super({ ...p, data: undefined, error: undefined });
    this.token = p.token;
    // parent is set later by parent node
  }

  static from<
    NTs extends string,
    ASTData,
    ErrorType,
    TokenType extends GeneralToken,
    Global,
  >(t: Readonly<TokenType>) {
    return new TNode<
      ExtractKinds<TokenType>,
      NTs,
      ASTData,
      ErrorType,
      TokenType,
      Global
    >({
      kind: t.kind,
      start: t.start,
      token: t,
    });
  }

  traverse(): ASTData | undefined {
    // for T nodes, data should be set by the user
    // and the traverse function won't calculate data
    // just return the data
    return this.data;
  }

  toString(): string {
    return `TNode(${JSON.stringify({
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
    }: ${
      // quote text, handle escape
      JSON.stringify(this.text)
    }\n`;
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
