import { ILexer } from "../../../lexer";
import { BaseCandidate, BaseState, BaseDFA } from "../DFA";
import { BaseParser } from "../parser";
import { BaseParserContext } from "./context";
import { GrammarRule, GrammarSet } from "./grammar";

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
  Child extends BaseDFA<T, After, Ctx, Candidate, State>
> = new (
  allGrammarRules: readonly GrammarRule<T, After, Ctx>[],
  entryNTs: ReadonlySet<string>,
  entryState: State,
  NTClosures: ReadonlyMap<string, GrammarRule<T, After, Ctx>[]>,
  /** `NT => Grammars` */
  firstSets: ReadonlyMap<string, GrammarSet>,
  /** `NT => Grammars` */
  followSets: ReadonlyMap<string, GrammarSet>,
  /** string representation of candidate => candidate */
  allInitialCandidates: ReadonlyMap<string, Candidate>,
  /** string representation of state => state */
  allStatesCache: Map<string, State>
) => Child;

export type ParserClassCtor<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Candidate extends BaseCandidate<T, After, Ctx, Candidate>,
  State extends BaseState<T, After, Ctx, Candidate, State>,
  DFA extends BaseDFA<T, After, Ctx, Candidate, State>,
  Parser extends BaseParser<T, DFA, Parser>
> = new (dfa: DFA, lexer: ILexer) => Parser;
