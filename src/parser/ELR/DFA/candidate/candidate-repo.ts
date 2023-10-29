import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type {
  GrammarRepo,
  GrammarRule,
  ReadonlyGrammarRuleRepo,
} from "../../model";
import { Candidate } from "./candidate";

/**
 * Store all candidates.
 */
export class CandidateRepo<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> {
  /**
   * Candidates. {@link Candidate.strWithGrammarName} => {@link Candidate}
   */
  private cs: Map<
    string,
    Candidate<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >
  >;

  constructor() {
    this.cs = new Map();
  }

  getKey(
    c: Pick<
      Candidate<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
      "gr" | "digested"
    >,
  ): string {
    return c instanceof Candidate
      ? c.strWithGrammarName
      : Candidate.getStrWithGrammarName(c);
  }

  get(
    c: Pick<
      Candidate<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
      "gr" | "digested"
    >,
  ) {
    return this.cs.get(this.getKey(c));
  }

  getByString(str: string) {
    return this.cs.get(str);
  }

  getInitial(
    gr: GrammarRule<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ) {
    return this.get({ gr, digested: 0 });
  }

  /**
   * If already exists, return `undefined`.
   */
  addInitial(
    gr: GrammarRule<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ) {
    const raw = { gr, digested: 0 };
    const key = this.getKey(raw);
    if (this.cs.has(key)) return undefined;

    const c = new Candidate<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >({
      ...raw,
      strWithGrammarName: key,
    });
    this.cs.set(key, c);
    return c;
  }

  /**
   * If already exists, return the cache, else create a new one and return.
   */
  addNext(
    c: Candidate<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ) {
    const raw = { gr: c.gr, digested: c.digested + 1 };
    const key = this.getKey(raw);
    const cache = this.cs.get(key);
    if (cache != undefined) return cache;

    const next = new Candidate<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >({
      ...raw,
      strWithGrammarName: key,
    });
    this.cs.set(key, next);
    return next;
  }

  toSerializable(
    grs: ReadonlyGrammarRuleRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ) {
    const res = [] as ReturnType<
      Candidate<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >["toSerializable"]
    >[];
    this.cs.forEach((c) => res.push(c.toSerializable(grs, this, repo)));
    return res;
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerError,
  >(
    data: ReturnType<
      CandidateRepo<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >["toSerializable"]
    >,
    grs: ReadonlyGrammarRuleRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ): ReadonlyCandidateRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  > {
    const callbacks = [] as ((
      cs: CandidateRepo<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
    ) => void)[];
    const res = new CandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >();
    data.forEach((d) => {
      const { c, restoreNextMap } = Candidate.fromJSON<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >(d, grs, repo);
      callbacks.push(restoreNextMap);
      res.cs.set(c.strWithGrammarName, c);
    });
    // restore next map after the whole candidate repo is filled
    callbacks.forEach((c) => c(res));
    return res;
  }
}

export type ReadonlyCandidateRepo<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = Omit<
  CandidateRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >,
  "addNext" | "addInitial"
>;
