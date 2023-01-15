import { ILexer } from "../../../lexer";
import { BaseDefinitionContextBuilder } from "../builder";
import { BaseCandidate, BaseState, BaseDFA } from "../DFA";
import { BaseParser } from "../parser";
import { BaseParserContext } from "./context";
import { GrammarRule } from "./grammar";

export type DFAClassCtor<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Candidate extends BaseCandidate<T, After, Ctx, Candidate>,
  State extends BaseState<T, After, Ctx, Candidate, State>,
  DFA extends BaseDFA<T, After, Ctx, Candidate, State>
> = new (
  allGrammarRules: readonly GrammarRule<T, After, Ctx>[],
  entryNTs: ReadonlySet<string>,
  NTs: ReadonlySet<string>
) => DFA;

export type ParserClassCtor<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Candidate extends BaseCandidate<T, After, Ctx, Candidate>,
  State extends BaseState<T, After, Ctx, Candidate, State>,
  DFA extends BaseDFA<T, After, Ctx, Candidate, State>,
  Parser extends BaseParser<T, DFA, Parser>
> = new (dfa: DFA, lexer: ILexer) => Parser;
