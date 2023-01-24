import { ASTNode } from "../../ast";
import { BaseParserBuilder } from "../../base";
import { Candidate, DFA, State } from "../DFA";
import { LRParserContext } from "../model";
import { Parser } from "../parser";
import { DefinitionContextBuilder } from "./ctx-builder";

/**
 * Builder for LR(1) parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * It's recommended to use `checkAll` before `build` when debug.
 */
export class ParserBuilder<T> extends BaseParserBuilder<
  T,
  ASTNode<T>[],
  LRParserContext<T>,
  Candidate<T>,
  State<T>,
  DFA<T>,
  Parser<T>,
  DefinitionContextBuilder<T>
> {
  constructor() {
    super(Candidate, State, DFA, Parser, DefinitionContextBuilder);
  }
}
