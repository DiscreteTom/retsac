import type { Candidate, ReadonlyNTClosures } from "..";
import { State } from "..";
import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type { Grammar, GrammarRepo, GrammarRule } from "../../model";
import { GrammarType } from "../../model";
import { notNullFilter } from "../../utils";
import type { CandidateRepo, ReadonlyCandidateRepo } from "../candidate";
import { stringMap2serializable } from "../utils";

/**
 * Store all states.
 */
export class StateRepo<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> {
  private ss: Map<
    string,
    State<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >
  >;

  constructor() {
    this.ss = new Map();
  }

  get states() {
    return this.ss as ReadonlyMap<
      string,
      State<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >
    >;
  }

  getKey(
    s: Pick<
      State<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
      "candidates"
    >,
  ): string {
    return s instanceof State ? s.str : State.getString(s);
  }

  get(
    s: Pick<
      State<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
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
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
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
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    grammar: Grammar<Kinds | ExtractKinds<LexerDataBindings>>,
    NTClosures: ReadonlyNTClosures<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    cs: CandidateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
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
          Kinds,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerError
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
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
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
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ) {
    return stringMap2serializable(this.ss, (s) =>
      s.toSerializable(cs, this, repo),
    );
  }

  static fromJSON<
    Kinds extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerError,
  >(
    data: ReturnType<
      StateRepo<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >["toSerializable"]
    >,
    cs: ReadonlyCandidateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ) {
    const ss = new StateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >();
    const callbacks = [] as ((
      ss: StateRepo<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
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
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = Omit<
  StateRepo<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >,
  "addEntry" | "addNext"
>;
