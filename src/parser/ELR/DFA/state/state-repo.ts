import type { Candidate, ReadonlyNTClosures } from "..";
import { State } from "..";
import type { Grammar, GrammarRepo, GrammarRule } from "../../model";
import { GrammarType } from "../../model";
import { notNullFilter } from "../../utils";
import type { CandidateRepo, ReadonlyCandidateRepo } from "../candidate";
import { stringMap2serializable } from "../utils";

/**
 * Store all states.
 */
export class StateRepo<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> {
  private ss: Map<
    string,
    State<ASTData, ErrorType, Kinds, LexerKinds, LexerError, LexerActionState>
  >;

  constructor() {
    this.ss = new Map();
  }

  get states() {
    return this.ss as ReadonlyMap<
      string,
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError, LexerActionState>
    >;
  }

  getKey(
    s: Pick<
      State<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError,
        LexerActionState
      >,
      "candidates"
    >,
  ): string {
    return s instanceof State ? s.str : State.getString(s);
  }

  get(
    s: Pick<
      State<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError,
        LexerActionState
      >,
      "candidates"
    >,
  ) {
    return this.ss.get(this.getKey(s));
  }

  getByString(str: string) {
    return this.ss.get(str);
  }

  /**
   * Return `undefined` if the state already exists.
   */
  addEntry(
    candidates: Candidate<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >[],
  ) {
    const raw = { candidates };
    const key = this.getKey(raw);
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
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
    grammar: Grammar<Kinds | LexerKinds>,
    NTClosures: ReadonlyNTClosures<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
    cs: CandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
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
          c.current!.type == GrammarType.NT &&
          !p.includes(c.current!.kind as Kinds)
        )
          p.push(c.current!.kind as Kinds);
        return p;
      }, [] as Kinds[]) // de-duplicated NT list
      .reduce(
        (p, c) => {
          NTClosures.get(c)!.forEach((gr) => {
            if (!p.includes(gr)) p.push(gr);
          });
          return p;
        },
        [] as GrammarRule<
          ASTData,
          ErrorType,
          Kinds,
          LexerKinds,
          LexerError,
          LexerActionState
        >[],
      ) // de-duplicated GrammarRule list
      .map(
        (gr) =>
          // get initial candidate from global cache
          cs.getInitial(gr)!,
      );
    const nextCandidates = directCandidates.concat(indirectCandidates);

    // no next states
    if (nextCandidates.length == 0) return { state: null, changed: false };

    // check cache
    const raw = { candidates: nextCandidates };
    const key = this.getKey(raw);
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
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError,
        LexerActionState
      >,
    ) => boolean,
  ) {
    for (const s of this.ss.values()) {
      if (f(s)) return true;
    }
    return false;
  }

  toSerializable(
    cs: ReadonlyCandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
    repo: GrammarRepo<Kinds, LexerKinds>,
  ) {
    return stringMap2serializable(this.ss, (s) =>
      s.toSerializable(cs, this, repo),
    );
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    data: ReturnType<
      StateRepo<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError,
        LexerActionState
      >["toSerializable"]
    >,
    cs: ReadonlyCandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >,
    repo: GrammarRepo<Kinds, LexerKinds>,
  ) {
    const ss = new StateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >();
    const callbacks = [] as ((
      ss: StateRepo<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError,
        LexerActionState
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
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> = Omit<
  StateRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >,
  "addEntry" | "addNext"
>;
