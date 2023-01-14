import {
  GrammarRule,
  GrammarSet,
  Grammar,
  GrammarType,
  BaseParserContext,
} from "../../model";
import { LR_BuilderError } from "../error";
import { TempConflict, ConflictType } from "../model";

/**
 * Return a grammar set contains NTs which might be the last input grammar.
 * E.g. entry NT is A, and we have `A: B C | D E`, then the result will be `{A, C, E}`.
 * These grammars will be used to check end of input.
 */
export function getEndSet<T, After>(
  entryNTs: ReadonlySet<string>,
  grs: readonly GrammarRule<T, After>[]
) {
  const result = new GrammarSet();

  // entry NTs might be the last input grammar of course
  entryNTs.forEach((nt) =>
    result.add(new Grammar({ content: nt, type: GrammarType.NT }))
  );

  while (true) {
    let changed = false;
    grs.forEach((gr) => {
      if (result.has(new Grammar({ content: gr.NT, type: GrammarType.NT }))) {
        // current NT is in result, so we need to check the last grammar of its rule
        if (gr.rule.at(-1)!.type == GrammarType.NT) {
          // last grammar is a NT, so we need to check it in result
          const last = new Grammar({
            content: gr.rule.at(-1)!.content,
            type: GrammarType.NT,
          });
          if (!result.has(last)) {
            result.add(last);
            changed = true;
          }
        }
      }
    });
    if (!changed) break;
  }

  return result;
}

/** Return conflicts that user didn't resolve. */
export function getUnresolvedConflicts<
  T,
  After,
  Ctx extends BaseParserContext<T, After>
>(
  resolved: readonly TempConflict<T, After, Ctx>[],
  NTs: ReadonlySet<string>,
  type: ConflictType,
  reducerRule: Readonly<GrammarRule<T, After>>,
  anotherRule: Readonly<GrammarRule<T, After>>,
  next: readonly Grammar[],
  checkHandleEnd: boolean,
  debug: boolean
) {
  const related = resolved.filter(
    (r) =>
      r.type == type &&
      r.reducerRule.weakEq(reducerRule) &&
      r.anotherRule.weakEq(anotherRule)
  );

  // collect resolve next & calculate unresolved next
  const resolvedNext = [] as Grammar[];
  related.forEach((r) =>
    r.next.forEach((n) => resolvedNext.push(n.toGrammar(NTs.has(n.content))))
  );
  const unresolvedNext = next.filter(
    (n) => !resolvedNext.some((rn) => n.eq(rn))
  );

  if (debug) {
    if (resolvedNext.length > 0)
      console.log(
        `[user resolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule.toString()} | ${anotherRule.toString()} next: ${resolvedNext}`
      );
    if (unresolvedNext.length > 0)
      console.log(
        `[unresolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule.toString()} | ${anotherRule.toString()} next: ${unresolvedNext}`
      );
  }

  // check end
  const endHandlers = related.filter((r) => r.handleEnd);
  if (endHandlers.length > 1) {
    throw LR_BuilderError.tooManyEndHandler(endHandlers[0].reducerRule);
  }
  let unresolvedEnd = checkHandleEnd;
  if (checkHandleEnd) {
    if (endHandlers.length == 1) {
      unresolvedEnd = !endHandlers[0].handleEnd;
    } else {
      // user didn't handle end of input
      unresolvedEnd = true;
    }
  }
  if (debug) {
    if (unresolvedEnd)
      console.log(
        `[unresolved RR]: ${reducerRule.toString()} | ${anotherRule.toString()} end of input`
      );
    if (unresolvedNext.length > 0)
      console.log(
        `[user resolved RR]: ${reducerRule.toString()} | ${anotherRule.toString()} end of input`
      );
  }

  return {
    next: unresolvedNext,
    /** If true, means user didn't handle end of input. */
    end: unresolvedEnd,
  };
}
