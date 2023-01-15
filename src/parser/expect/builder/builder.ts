import { BaseParserBuilder } from "../../base";
import { Candidate, DFA, State } from "../DFA";
import { ParserContext } from "../model";
import { Parser } from "../parser";
import { DefinitionContextBuilder } from "./ctx-builder";

/**
 * Builder for Expectational LR parsers.
 *
 * Use `entry` to set entry NTs, use `define` to define grammar rules, use `build` to get parser.
 *
 * It's recommended to use `checkAll` before `build` when debug.
 */
export class ParserBuilder<T> extends BaseParserBuilder<
  T,
  string,
  ParserContext<T>,
  Candidate<T>,
  State<T>,
  DFA<T>,
  Parser<T>,
  DefinitionContextBuilder<T>
> {
  constructor() {
    super(DFA, Parser, DefinitionContextBuilder);
  }
}
