import type { Logger } from "../../../logger";
import type { ReadonlyFollowSets } from "../DFA";
import type { Conflict, GrammarRule, GrammarRuleRepo } from "../model";
import {
  UnknownGrammarError,
  DuplicatedDefinitionError,
  UnknownEntryNTError,
  ConflictError,
  NextGrammarNotFoundError,
  NoSuchConflictError,
  RollbackDefinedWhileNotEnabledError,
} from "./error";

/**
 * Ensure all T/NTs have their definitions, and no duplication, and all literals are valid.
 * If `printAll` is true, print all errors instead of throwing error.
 * @throws if `printAll` is false and there is any error.
 */
export function checkSymbols<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
>(
  entryNTs: ReadonlySet<string>,
  NTs: ReadonlySet<string>,
  Ts: ReadonlySet<string>,
  // grammar rule repo is already readonly
  // TODO: rename GrammarRuleRepo to ReadonlyGrammarRuleRepo?
  grs: GrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>,
  printAll: boolean,
  logger: Logger
) {
  // all grammar symbols should have its definition, either in NTs or Ts
  grs.grammarRules.forEach((gr) => {
    gr.rule.forEach((g) => {
      if (g.text == undefined) {
        // N/NT
        if (!Ts.has(g.kind) && !NTs.has(g.kind)) {
          const e = new UnknownGrammarError(g.kind);
          if (printAll) logger(e.message);
          else throw e;
        }
      }
    });
  });

  // check duplication
  NTs.forEach((name) => {
    if (Ts.has(name)) {
      const e = new DuplicatedDefinitionError(name);
      if (printAll) logger(e.message);
      else throw e;
    }
  });

  // entry NTs must in NTs
  entryNTs.forEach((NT) => {
    if (!NTs.has(NT)) {
      const e = new UnknownEntryNTError(NT);
      if (printAll) logger(e.message);
      else throw e;
    }
  });

  // all literals must be able to be tokenized by lexer
  // this is this already checked when GrammarRepo create the grammar
  // lexer = lexer.dryClone();
  // grs.grammarRules.forEach((gr) => {
  //   gr.rule.forEach((grammar) => {
  //     if (grammar.text != undefined) {
  //       if (lexer.reset().lex(grammar.text!) == null) {
  //         const e = new InvalidLiteralError(grammar.text!);
  //         if (printAll) logger(e.message);
  //         else throw e;
  //       }
  //     }
  //   });
  // });
}

/**
 * Ensure all reduce-shift and reduce-reduce conflicts are resolved.
 * If `printAll` is true, print all conflicts instead of throwing error.
 * @throws if `printAll` is false and there is any error.
 */
export function checkConflicts<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
>(
  followSets: ReadonlyFollowSets,
  unresolved: ReadonlyMap<
    Readonly<GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>>,
    readonly Readonly<Conflict<ASTData, ErrorType, Kinds, LexerKinds>>[]
  >,
  grs: GrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>,
  printAll: boolean,
  logger: Logger
) {
  // ensure all conflicts are resolved
  unresolved.forEach((cs, gr) => {
    cs.forEach((c) => {
      const err = new ConflictError(gr, c);
      if (printAll) logger(err.message);
      else throw err;
    });
  });

  // ensure all grammar rules resolved are appeared in the grammar rules
  // this is done in `buildDFA`

  // ensure all next grammars in resolved rules indeed in the follow set of the reducer rule's NT
  grs.grammarRules.forEach((reducerRule) => {
    reducerRule.resolved.forEach((g) => {
      if (g.next == "*") return;
      g.next.grammars.forEach((n) => {
        if (!followSets.get(reducerRule.NT)!.has(n)) {
          const err = new NextGrammarNotFoundError(n, reducerRule.NT);
          if (printAll) logger(err.message);
          else throw err;
        }
      });
    });
  });

  // ensure all resolved are indeed conflicts
  grs.grammarRules.forEach((reducerRule) => {
    reducerRule.resolved.forEach((c) => {
      // check next
      if (c.next != "*")
        c.next.grammars.forEach((n) => {
          if (
            !reducerRule.conflicts.some(
              (conflict) =>
                c.anotherRule == conflict.anotherRule &&
                c.type == conflict.type &&
                conflict.next.some((nn) => n.equalWithoutName(nn)) // don't use `==` here since we don't want to compare grammar name
            )
          ) {
            const err = new NoSuchConflictError(
              reducerRule,
              c.anotherRule,
              c.type,
              [n],
              false
            );
            if (printAll) logger(err.message);
            else throw err;
          }
        });
      // check handleEnd
      if (
        c.next != "*" &&
        c.handleEnd &&
        reducerRule.conflicts.some(
          (conflict) =>
            c.anotherRule == conflict.anotherRule &&
            c.type == conflict.type &&
            conflict.handleEnd
        )
      ) {
        const err = new NoSuchConflictError(
          reducerRule,
          c.anotherRule,
          c.type,
          [],
          true
        );
        if (printAll) logger(err.message);
        else throw err;
      }
    });
  });
}

/**
 * Ensure no rollback is defined.
 * If `printAll` is true, print all errors instead of throwing error.
 * @throws if `printAll` is false and there is any error.
 */
export function checkRollbacks<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
>(
  grs: GrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>,
  printAll: boolean,
  logger: Logger
) {
  grs.grammarRules.forEach((gr) => {
    if (gr.rollback !== undefined) {
      const e = new RollbackDefinedWhileNotEnabledError(gr);
      if (printAll) logger(e.message);
      else throw e;
    }
  });
}
