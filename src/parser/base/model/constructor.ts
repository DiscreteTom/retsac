import { ILexer } from "../../../lexer";
import { BaseCandidate, BaseState, BaseDFA } from "../DFA";
import { BaseParser } from "../parser";
import { BaseParserContext } from "./context";
import { GrammarRule } from "./grammar";

export type CandidateClassCtor<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Child extends BaseCandidate<T, After, Ctx, Child>
> = new (
  data: Pick<BaseCandidate<T, After, Ctx, Child>, "gr" | "digested">
) => Child;

export type StateClassCtor<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Candidate extends BaseCandidate<T, After, Ctx, Candidate>,
  Child extends BaseState<T, After, Ctx, Candidate, Child>
> = new (candidates: Candidate[]) => Child;

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
