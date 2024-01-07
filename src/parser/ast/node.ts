import { anonymousKindPlaceholder } from "../../anonymous";
import type { StringOrLiteral } from "../../helper";
import type { ExtractKinds, GeneralToken } from "../../lexer";
import type { ASTNode, ASTObj, NTNode, TNode } from "./interface";
import type {
  NTNodeFirstMatchChildSelector,
  NTNodeChildrenSelector,
  ASTNodeFirstMatchSelector,
  ASTNodeSelector,
} from "../selector";
import type { NTNodeTraverser } from "../traverser";
import { defaultNTNodeTraverser } from "../traverser";

export abstract class AbstractASTNode<
  Kind extends NTs | ExtractKinds<TokenType>, // the kind name of this node
  NTs extends string, // all NTs' kind names
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> implements ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>
{
  name: string;
  readonly kind: Kind;
  readonly start: number;
  data: ASTData | undefined;
  error: ErrorType | undefined;
  parent?: NTNode<NTs, NTs, ASTData, ErrorType, TokenType, Global>;
  readonly global: Global;

  // should only be used by subclasses
  protected constructor(
    p: Pick<
      AbstractASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
      "kind" | "start" | "data" | "error" | "global"
    >,
  ) {
    this.kind = p.kind;
    this.start = p.start;
    this.data = p.data;
    this.error = p.error;
    this.global = p.global;

    // name & parent will be set when the parent node is created
    // so in constructor, we should use the default name & parent
    this.name = this.kind;
  }

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

  isT(): this is TNode<
    Kind & ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  > {
    return this.asASTNode().$ === undefined; // TODO: is this the fastest way? maybe `'$' in this`?
  }

  isNT(): this is NTNode<
    Kind & NTs,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  > {
    return this.asASTNode().$ !== undefined; // TODO: is this the fastest way? maybe `'$' in this`?
  }

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

  asASTNode(): ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global> {
    return this as ASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>;
  }

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

  abstract toString(): string;
  abstract toJSON(): ASTObj;
  abstract traverse(): ASTData | undefined;
}

// TODO: better name?
export class TheNTNode<
    Kind extends NTs, // the kind name of this node
    NTs extends string, // all NTs' kind names
    ASTData,
    ErrorType,
    TokenType extends GeneralToken,
    Global,
  >
  extends AbstractASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>
  implements NTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>
{
  readonly children: readonly ASTNode<
    NTs | ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >[];

  readonly $: NTNodeFirstMatchChildSelector<
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >;

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

  constructor(
    p: Pick<
      TheNTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
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

export class TheTNode<
    Kind extends ExtractKinds<TokenType>, // the kind name of this node
    NTs extends string, // all NTs' kind names
    ASTData,
    ErrorType,
    TokenType extends GeneralToken,
    Global,
  >
  extends AbstractASTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>
  implements TNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>
{
  readonly text: string;

  private constructor(
    p: Pick<
      TNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
      "kind" | "start" | "data" | "global" | "text"
    >,
  ) {
    super({
      ...p,
      error: undefined,
    });
    this.text = p.text;
  }

  static from<
    NTs extends string,
    ASTData,
    ErrorType,
    TokenType extends GeneralToken,
    Global,
  >(t: Readonly<TokenType>, data: ASTData | undefined, global: Global) {
    return new TheTNode<
      ExtractKinds<TokenType>,
      NTs,
      ASTData,
      ErrorType,
      TokenType,
      Global
    >({
      kind: t.kind,
      start: t.start,
      text: t.content,
      data,
      global,
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
