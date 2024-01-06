import type { Candidate, ReadonlyNTClosures, StateID } from "..";
import { State } from "..";
import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type { Grammar, GrammarRepo, GrammarRule } from "../../model";
import { GrammarType } from "../../model";
import { notNullFilter } from "../../utils";
import type { CandidateRepo, ReadonlyCandidateRepo } from "../candidate";
import { stringMap2serializable } from "../utils";

/**
 * Store all states.
 *
 * The key of the map is the {@link StateID}.
 */
export class StateRepo<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> {
  private ss: Map<
    StateID,
    State<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >
  >;

  constructor() {
    this.ss = new Map();
  }

  get states() {
    // make readonly
    return this.ss as ReadonlyMap<
      string,
      State<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >;
  }

  get(id: string) {
    return this.ss.get(id);
  }

  /**
   * Return `undefined` if the state already exists.
   */
  addEntry(
    candidates: Candidate<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >[],
  ) {
    const raw = { candidates };
    const key = State.generateId(raw);
    if (this.ss.has(key)) return undefined;

    const s = new State(candidates, key);
    this.ss.set(key, s);
    return s;
  }

  /**
   * If next state doesn't exist(no candidates), return `undefined`.
   * If next state exist and cached, return the cached state.
   * If next state exist and not cached, then create and cached and return the new state.
   */
  addNext(
    current: State<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    grammar: Grammar<NTs | ExtractKinds<LexerDataBindings>>,
    NTClosures: ReadonlyNTClosures<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    cs: CandidateRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ) {
    const directCandidates = current.candidates
      .filter((c) => c.current?.equalWithoutName(grammar)) // current grammar match the next node, name should be ignored since the next node's name is defined by its parent
      .map((c) => c.generateNext(cs))
      .filter(notNullFilter);
    const indirectCandidates = directCandidates
      .reduce((p, c) => {
        if (
          c.canDigestMore() &&
          c.current!.type === GrammarType.NT &&
          !p.includes(c.current!.kind as NTs)
        )
          p.push(c.current!.kind as NTs);
        return p;
      }, [] as NTs[]) // de-duplicated NT list
      .reduce(
        (p, c) => {
          NTClosures.get(c)!.forEach((gr) => {
            if (!p.includes(gr)) p.push(gr);
          });
          return p;
        },
        [] as GrammarRule<
          NTs,
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >[],
      ) // de-duplicated GrammarRule list
      .map(
        (gr) =>
          // get initial candidate from global cache
          cs.getInitial(gr)!,
      );
    const nextCandidates = directCandidates.concat(indirectCandidates);

    // no next states
    if (nextCandidates.length === 0) return { state: null, changed: false };

    // check cache
    const raw = { candidates: nextCandidates };
    const key = State.generateId(raw);
    const cache = this.ss.get(key);
    if (cache !== undefined) return { state: cache, changed: false };

    // create new
    const s = new State(nextCandidates, key);
    this.ss.set(key, s);
    return { state: s, changed: true };
  }

  some(
    f: (
      s: State<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >,
    ) => boolean,
  ) {
    for (const s of this.ss.values()) {
      if (f(s)) return true;
    }
    return false;
  }

  toJSON() {
    return stringMap2serializable(this.ss, (s) => s.toJSON());
  }

  static fromJSON<
    NTs extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
    Global,
  >(
    data: ReturnType<
      StateRepo<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >["toJSON"]
    >,
    cs: ReadonlyCandidateRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    repo: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
  ) {
    const ss = new StateRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >();
    const callbacks = [] as ((
      ss: StateRepo<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >,
    ) => void)[];
    for (const key in data) {
      const { s, restoreNextMap } = State.fromJSON(data[key], cs, repo);
      ss.ss.set(key, s);
      callbacks.push(restoreNextMap);
    }
    // restore nextMap after the whole state repo is filled.
    callbacks.forEach((c) => c(ss));
    return ss;
  }
}

export type ReadonlyStateRepo<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> = Omit<
  StateRepo<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
  "addEntry" | "addNext"
>;
