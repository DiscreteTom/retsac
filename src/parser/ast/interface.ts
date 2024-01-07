import type { ExtractKinds, GeneralToken } from "../../lexer";
import type {
  NTNodeFirstMatchChildSelector,
  NTNodeChildrenSelector,
} from "../selector";

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

export interface ASTNode<
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
   */
  // * This is not readonly because it will be set by parent node.
  parent?: NTNode<NTs, NTs, ASTData, ErrorType, TokenType, Global>;
  /**
   * Global data, shared by all nodes.
   */
  readonly global: Global; // this should be a reference type. make this readonly
  /**
   * Token's text content.
   * `undefined` if this is {@link NTNode}.
   */
  readonly text?: string;
  /**
   * `undefined` if this is {@link TNode}.
   */
  readonly children?: readonly ASTNode<
    NTs | ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >[];
  /**
   * Select the first matched child node by the name.
   * `undefined` if this is {@link TNode}.
   */
  readonly $?: NTNodeFirstMatchChildSelector<
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >;
  /**
   * Select children nodes by the name.
   * `undefined` if this is {@link TNode}.
   */
  readonly $$?: NTNodeChildrenSelector<
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >;
  /**
   * Use the traverser to calculate data and return the data.
   */
  traverse(): ASTData | undefined;
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
  }): string;
  /**
   * {@link ASTNode.toTreeString} with full options.
   */
  _toTreeString(options: {
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
  toString(): string;
  /**
   * Return an ASTObj for serialization.
   */
  toJSON(): ASTObj;
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
      >;
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
  >;
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
  >;
  /**
   * Cast this node to another kind. No type check.
   */
  as<TargetKind extends Kind>(
    kind: TargetKind,
  ): TargetKind extends NTs
    ? NTNode<TargetKind & NTs, NTs, ASTData, ErrorType, TokenType, Global>
    : TNode<
        TargetKind & ExtractKinds<TokenType>,
        NTs,
        ASTData,
        ErrorType,
        TokenType,
        Global
      >;
  /**
   * Cast this node to a T node. No type check.
   */
  asT(): TNode<
    Kind & ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >;

  /**
   * Cast this node to an NT node. No type check.
   */
  asNT(): NTNode<Kind & NTs, NTs, ASTData, ErrorType, TokenType, Global>;
}

export type NTNode<
  Kind extends NTs, // the kind name of this node
  NTs extends string, // all NTs' kind names
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> = Pick<
  ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
  | "name"
  | "kind"
  | "start"
  | "data"
  | "error"
  | "parent"
  | "global"
  | "traverse"
  | "toTreeString"
  | "toString"
  | "toJSON"
  | "is"
  | "as"
> &
  Required<
    Pick<
      ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
      "children" | "$" | "$$"
    >
  > & {
    asASTNode(): ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>;
  };

export type TNode<
  Kind extends ExtractKinds<TokenType>, // the kind name of this node
  NTs extends string, // all NTs' kind names
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> = Pick<
  ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
  | "name"
  | "kind"
  | "start"
  | "data"
  | "error"
  | "parent"
  | "global"
  | "traverse"
  | "toTreeString"
  | "toString"
  | "toJSON"
  | "is"
  | "as"
> &
  Required<
    Pick<ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>, "text">
  > & {
    asASTNode(): ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>;
  };
