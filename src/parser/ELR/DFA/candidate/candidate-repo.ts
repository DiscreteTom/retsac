import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type {
  GrammarRepo,
  GrammarRule,
  ReadonlyGrammarRuleRepo,
} from "../../model";
import { Candidate } from "./candidate";

/**
 * Store all candidates.
 *
 * The key of the map is the {@link Candidate.id}.
 */
export class CandidateRepo<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> {
  /**
   * Candidates. {@link Candidate.id} => {@link Candidate}
   */
  private cs: Map<
    string,
    Candidate<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >
  >;

  constructor() {
    this.cs = new Map();
  }

  /**
   * Get the candidate by the {@link Candidate.id}.
   */
  get(id: string) {
    return this.cs.get(id);
  }

  getInitial(
    gr: GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
  ) {
    return this.get(Candidate.generateId({ gr, digested: 0 }));
  }

  /**
   * If already exists, return `undefined`.
   */
  addInitial(
    gr: GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
  ) {
    const raw = { gr, digested: 0 };
    const id = Candidate.generateId(raw);
    if (this.cs.has(id)) return undefined;

    const c = new Candidate<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >({
      ...raw,
      id,
    });
    this.cs.set(id, c);
    return c;
  }

  /**
   * If already exists, return the cache, else create a new one and return.
   */
  addNext(
    c: Candidate<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
  ) {
    const raw = { gr: c.gr, digested: c.digested + 1 };
    const id = Candidate.generateId(raw);
    const cache = this.cs.get(id);
    if (cache !== undefined) return cache;

    const next = new Candidate<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >({
      ...raw,
      id,
    });
    this.cs.set(id, next);
    return next;
  }

  toJSON() {
    const res = [] as ReturnType<
      Candidate<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >["toJSON"]
    >[];
    this.cs.forEach((c) => res.push(c.toJSON()));
    return res;
  }

  static fromJSON<
    Kinds extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
  >(
    data: ReturnType<
      CandidateRepo<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >["toJSON"]
    >,
    grs: ReadonlyGrammarRuleRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ): ReadonlyCandidateRepo<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  > {
    const callbacks = [] as ((
      cs: CandidateRepo<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >,
    ) => void)[];
    const res = new CandidateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >();
    data.forEach((d) => {
      const { c, restoreNextMap } = Candidate.fromJSON<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >(d, grs, repo);
      callbacks.push(restoreNextMap);
      res.cs.set(c.id, c);
    });
    // restore next map after the whole candidate repo is filled
    callbacks.forEach((c) => c(res));
    return res;
  }
}

export type ReadonlyCandidateRepo<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = Omit<
  CandidateRepo<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >,
  "addNext" | "addInitial"
>;
