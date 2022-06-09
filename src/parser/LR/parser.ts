import { Lexer, Token } from "../../lexer/lexer";
import { exact, stringLiteral } from "../../lexer/utils";
import { ASTNode } from "../ast";
import { Parser, ParserOutput } from "../model";
import { GrammarCallback, ReducerContext, Rejecter } from "../simple/model";
import { Grammar, GrammarRule, GrammarSet } from "./model";

const grammarLexer = new Lexer()
  .ignore(
    /^\s/ // blank
  )
  .define({
    grammar: /^\w+/,
    or: exact("|"),
    literal: stringLiteral({ single: true, double: true }),
  });

type TempGrammar = {
  type: "literal" | "grammar";
  content: string;
};

type TempGrammarRule = {
  rule: TempGrammar[];
  NT: string; // the reduce target
  callback: GrammarCallback;
  rejecter: Rejecter;
};

type Definition = { [NT: string]: string | string[] };

/**
 * Builder for LR parsers.
 *
 * Use `define` to define grammar rules, use `build` to get parser.
 */
export class LRParserBuilder {
  private tempGrammarRules: TempGrammarRule[];
  private entryNTs: Set<string>;

  constructor() {
    this.tempGrammarRules = [];
    this.entryNTs = new Set();
  }

  /** Top-level NT's. */
  entry(defs: string | string[]) {
    this.entryNTs = new Set(defs instanceof Array ? defs : [defs]);
    return this;
  }

  /**
   * Definition syntax:
   * - `A | B` means `A` or `B`
   * - `A B` means `A` then `B`
   * - `'xxx'` or `"xxx"` means literal string `xxx`
   *   - Escaped quote is supported. E.g.: `'abc\'def'`
   *
   * E.g.:
   *
   * ```js
   * define({ exp: `A B | 'xxx' B` })
   * // means `A B` or `'xxx' B`, and reduce to `exp`
   * // equals to:
   * define({ exp: [`A B`, `'xxx' B`] })
   * ```
   */
  define(defs: Definition, callback?: GrammarCallback, rejecter?: Rejecter) {
    this.tempGrammarRules.push(
      ...definitionToTempGrammarRules(defs, callback, rejecter)
    );

    return this;
  }

  build(): Parser {
    let NTs = new Set(this.tempGrammarRules.map((gr) => gr.NT));
    let grammarRules = tempGrammarRulesToGrammarRules(
      this.tempGrammarRules,
      NTs
    );
    let first = getFirst(grammarRules, NTs);
    let entryGrammarClosures = getGrammarRulesClosure(
      grammarRules.filter((gr) => this.entryNTs.has(gr.NT)),
      grammarRules
    );

    return (buffer) => {
      // try to apply `gr` to buffer[index:]
      function tryReduce(
        buffer: ASTNode[],
        index: number,
        gr: GrammarRule
      ): ParserOutput {
        if (buffer.length < gr.rule.length) return { accept: false };

        buffer = [...buffer];
        let errors: ASTNode[] = [];

        outer: for (let i = 0; i < gr.rule.length; ++i) {
          const g = gr.rule[i];

          if (g.eq(buffer[index + i]))
            // match
            continue;
          if (g.type == "literal" || g.type == "T")
            // not match and not recurse-able
            return { accept: false };
          // NT, maybe recurse
          if (first.get(g.content).has(buffer[index + i])) {
            // recurse
            for (const candidate of grammarRules.filter(
              (gr) => gr.NT == g.content
            )) {
              let res = tryReduce(buffer, index + i, candidate);
              if (res.accept == true) {
                buffer = res.buffer;
                errors.push(...res.errors);
                continue outer;
              }
            }
            // recurse failed
            return { accept: false };
          } else {
            return { accept: false };
          }
        }

        // can reduce, check rejecter & callback
        let context: ReducerContext = {
          matched: buffer.slice(index, index + gr.rule.length),
          before: buffer.slice(0, index),
          after: buffer.slice(index + gr.rule.length),
          error: "",
          data: { value: null },
        };
        if (
          gr.rejecter({
            matched: buffer.slice(index, index + gr.rule.length),
            before: buffer.slice(0, index),
            after: buffer.slice(index + gr.rule.length),
            error: "",
            data: { value: null },
          })
        )
          return { accept: false };
        // reduce data
        gr.callback(context);
        // update buffer state
        let node = new ASTNode({
          type: gr.NT,
          data: context.data,
          children: context.matched,
          error: context.error,
        });
        node.children.map((c) => (c.parent = node));
        buffer = context.before.concat(node).concat(context.after);
        if (context.error) errors.push(node);
        return { accept: true, buffer, errors };
      }

      for (const gr of entryGrammarClosures) {
        let res = tryReduce(buffer, 0, gr);
        if (res.accept)
          return {
            accept: true,
            buffer: res.buffer,
            errors: res.errors,
          };
      }

      return { accept: false };
    };
  }

  /**
   * Ensure all symbols have their definitions, and no duplication.
   */
  // checkSymbols(externalSymbols: Set<string>) {
  //   let ntNameSet: Set<string> = new Set(); // non-terminator definitions
  //   let symbolSet: Set<string> = new Set();

  //   // collect NT names and grammars
  //   this.grammarRules.map((g) => {
  //     ntNameSet.add(g.NT);
  //     g.rule.map((grammar) => {
  //       if (grammar.type == "grammar") symbolSet.add(grammar.content);
  //     });
  //   });

  //   // all symbols should have its definition
  //   symbolSet.forEach((symbol) => {
  //     if (!externalSymbols.has(symbol) && !ntNameSet.has(symbol))
  //       throw new Error(`Undefined symbol: ${symbol}`);
  //   });

  //   // check duplication
  //   ntNameSet.forEach((name) => {
  //     if (externalSymbols.has(name))
  //       throw new Error(`Duplicated definition: ${name}`);
  //   });

  //   return this;
  // }
}

function definitionToTempGrammarRules(
  defs: Definition,
  callback?: GrammarCallback,
  rejecter?: Rejecter
) {
  let result: TempGrammarRule[] = [];

  // parse rules
  for (const NT in defs) {
    let rules: Token[][] = [[]];
    let def = defs[NT];
    grammarLexer
      .reset()
      .lexAll(def instanceof Array ? def.join("|") : def)
      .map((t) => {
        if (t.type == "or") rules.push([]);
        else rules.at(-1).push(t);
      });

    if (grammarLexer.hasRest())
      throw new Error(
        `Can't tokenize: "${grammarLexer.getRest()}" in grammar rule: "${
          defs[NT]
        }"`
      );
    if (rules.length == 0 && rules[0].length == 0)
      throw new Error(`Empty rule: "${NT}=>${defs[NT]}"`);

    rules.map((tokens) => {
      let ruleStr = tokens.join(" ");

      if (tokens.length == 0)
        throw new Error(`No grammar or literal in rule '${NT}=>${ruleStr}'`);

      if (
        !tokens
          .filter((t) => t.type == "literal")
          .every((t) => t.content.length > 2)
      )
        throw new Error(
          `Literal value can't be empty in rule '${NT}=>${ruleStr}'`
        );

      result.push({
        NT,
        rule: tokens.map((t) => {
          if (t.type == "grammar")
            return {
              type: "grammar",
              content: t.content,
            };
          else
            return {
              type: "literal",
              content: t.content.slice(1, -1), // remove quotes
            };
        }),
        callback,
        rejecter,
      });
    });
  }
  return result;
}

function tempGrammarRulesToGrammarRules(
  temp: TempGrammarRule[],
  NTs: Set<string>
) {
  return temp.map(
    (gr) =>
      new GrammarRule({
        NT: gr.NT,
        callback: gr.callback,
        rejecter: gr.rejecter,
        rule: gr.rule.map(
          (g) =>
            new Grammar({
              content: g.content,
              type:
                g.type == "literal" ? g.type : NTs.has(g.content) ? "NT" : "T",
            })
        ),
      })
  );
}

function getGrammarRulesClosure(
  rules: GrammarRule[],
  grammarRules: GrammarRule[]
): GrammarRule[] {
  let result = [...rules];

  while (true) {
    let changed = false;
    result.map((gr) => {
      if (gr.rule[0].type == "NT") {
        grammarRules
          .filter((gr2) => gr2.NT == gr.rule[0].content)
          .map((gr) => {
            if (result.includes(gr)) return;
            changed = true;
            result.push(gr);
          });
      }
    });

    if (!changed) break;
  }

  return result;
}

function getFirst(
  grs: GrammarRule[],
  NTs: Set<string>
): Map<string, GrammarSet> {
  // init result
  let result: Map<string, GrammarSet> = new Map();
  NTs.forEach((NT) => result.set(NT, new GrammarSet()));

  function updateFirst(first: GrammarSet, g: Grammar) {
    let changed = first.add(g);

    // if NT, recurse
    if (changed && g.type == "NT")
      result.get(g.content).map((gg) => updateFirst(first, gg));

    return changed;
  }

  while (true) {
    let changed = false;
    grs.map((gr) => (changed ||= updateFirst(result.get(gr.NT), gr.rule[0])));
    if (!changed) break;
  }

  return result;
}
