import type { Candidate } from "..";
import { State } from "..";
import type { Grammar, GrammarRepo, GrammarRule } from "../../model";
import { GrammarType } from "../../model";
import { nonNullFilter } from "../../utils";
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
> {
  private ss: Map<
    string,
    State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
  >;

  constructor() {
    this.ss = new Map();
  }

  get states() {
    return this.ss as ReadonlyMap<
      string,
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
    >;
  }

  getKey(
    s: Pick<
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
      "candidates"
    >,
  ): string {
    return s instanceof State ? s.str : State.getString(s);
  }

  get(
    s: Pick<
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
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
    candidates: Candidate<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
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
    current: State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    grammar: Grammar<Kinds | LexerKinds>,
    NTClosures: ReadonlyMap<
      string,
      GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[]
    >,
    cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  ) {
    const directCandidates = current.candidates
      .filter((c) => c.current?.equalWithoutName(grammar)) // current grammar match the next node, name should be ignored since the next node's name is defined by its parent
      .map((c) => c.generateNext(cs))
      .filter(nonNullFilter);
    const indirectCandidates = directCandidates
      .reduce((p, c) => {
        if (
          c.canDigestMore() &&
          c.current!.type == GrammarType.NT &&
          !p.includes(c.current!.kind)
        )
          p.push(c.current!.kind);
        return p;
      }, [] as string[]) // de-duplicated NT list
      .reduce(
        (p, c) => {
          NTClosures.get(c)!.forEach((gr) => {
            if (!p.includes(gr)) p.push(gr);
          });
          return p;
        },
        [] as GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[],
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
    f: (s: State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>) => boolean,
  ) {
    for (const s of this.ss.values()) {
      if (f(s)) return true;
    }
    return false;
  }

  toJSON(
    cs: ReadonlyCandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    repo: GrammarRepo<Kinds | LexerKinds>,
  ) {
    return stringMap2serializable(this.ss, (s) => s.toJSON(cs, this, repo));
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
  >(
    data: ReturnType<
      StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>["toJSON"]
    >,
    cs: ReadonlyCandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    repo: GrammarRepo<Kinds | LexerKinds>,
  ) {
    const ss = new StateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >();
    const callbacks = [] as ((
      ss: StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
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
> = Omit<
  StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  "addEntry" | "addNext"
>;
