import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { GrammarType, GrammarSet, Grammar } from "../../base";
import { BaseCandidate } from "../../base/DFA";
import { ParserOutput } from "../../model";
import { ParserContext } from "../model";

/** A.k.a: LR(1) Project for expectational LR. */
export class Candidate<T> extends BaseCandidate<
  T,
  string,
  ParserContext<T>,
  Candidate<T>
> {
  /**
   * Candidate should only be created when:
   *
   * 1. Create initial candidates by DFA.
   * 2. Create next candidates by `Candidate.getNext`.
   * 3. Get string value by `Candidate.getString`.
   *
   * This will ensure that all candidates are unique and only one instance exists.
   */
  constructor(data: Pick<Candidate<T>, "gr" | "digested">) {
    super(data, Candidate);
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content specified by `this.current`.
   * Return all the possible results.
   */
  tryLex(
    lexer: ILexer,
    followSets: ReadonlyMap<string, GrammarSet>
  ): { node: ASTNode<T>; lexer: ILexer }[] {
    if (this.canDigestMore()) {
      const res = lexGrammar<T>(this.current, lexer);
      if (res != null) return [{ node: res, lexer }];
      else return [];
    }

    // else, digestion finished, check follow set
    const followSet = followSets.get(this.gr.NT)!;
    return followSet
      .map((g) => {
        const l = lexer.clone(); // clone lexer to avoid side effect
        return {
          node: lexGrammar<T>(g, l),
          lexer: l,
        };
      })
      .filter((r) => r.node != null) as { node: ASTNode<T>; lexer: ILexer }[];
  }

  /**
   * Only failed if:
   * 1. Digestion not finished.
   * 2. Check follow set failed.
   * 3. Rejecter rejected.
   */
  tryReduce(
    buffer: readonly ASTNode<T>[],
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyMap<string, GrammarSet>,
    lexer: ILexer,
    debug: boolean
  ): ParserOutput<T> {
    if (this.canDigestMore()) return { accept: false };

    const context: ParserContext<T> = {
      matched: buffer.slice(-this.gr.rule.length),
      before: buffer.slice(0, -this.gr.rule.length),
      after: lexer.getRest(),
      lexer,
    };

    // check follow for LR(1) with the rest input string
    if (
      context.after.length > 0 &&
      // important! make sure lexer can still lex something not muted
      // otherwise, we will get stuck because lexer will always return null and follow set check will always fail
      lexer.clone().trimStart().hasRest()
    ) {
      if (entryNTs.has(this.gr.NT)) {
        // entry NT, no need to check follow set
        // e.g. when we parse `int a; int b;`, we don't need to check follow set for `;`
      } else if (
        followSets
          .get(this.gr.NT)!
          .map((g) =>
            lexer
              .clone() // clone with state to prevent side effect
              .lex({
                expect: {
                  type: g.toASTNode(lexer).type,
                  text: g.toASTNode(lexer).text,
                },
              })
          )
          .every((x) => x == null)
      ) {
        if (debug)
          console.log(
            `[Follow Mismatch] ${this.gr.toString()} follow=${context.after.slice(
              0,
              10 // only show first 10 chars
            )}`
          );
        return { accept: false };
      }
      // else, follow set matched, continue
    }

    // check rejecter
    if (this.gr.rejecter(context)) {
      if (debug) console.log(`[Reject] ${this.gr.toString()}`);
      return { accept: false };
    }

    // accept
    this.gr.callback(context);
    const node = new ASTNode({
      type: this.gr.NT,
      children: context.matched,
      data: context.data,
      error: context.error,
      start: context.matched[0].start,
    });
    node.children!.map((c) => (c.parent = node)); // link parent
    if (debug) console.log(`[Accept] ${this.gr.toString()}`);

    return {
      accept: true,
      buffer: context.before.concat(node),
      errors: context.error ? [node] : [],
    };
  }
}

function lexGrammar<T>(g: Grammar, lexer: ILexer): ASTNode<T> | null {
  if (g.type == GrammarType.NT) {
    return null;
  } else {
    // try to lex to get the token
    const token = lexer.lex({
      expect: {
        type: g.toASTNode(lexer).type,
        text: g.toASTNode(lexer).text,
      },
    });
    if (token == null) {
      return null;
    } else {
      return ASTNode.from<T>(token);
    }
  }
}
