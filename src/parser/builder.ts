import { Lexer } from "../lexer/lexer";
import { ConflictType, GrammarRule, NaiveLR } from "./naive";
import { Parser } from "./parser";

export class Builder {
  private defs: Map<string, string>; // non-terminator => grammar string
  lexer: Lexer;

  constructor(lexer?: Lexer) {
    this.defs = new Map();
    this.lexer = lexer;
  }

  setLexer(lexer: Lexer) {
    this.lexer = lexer;
    return this;
  }

  define(defs: { [name: string]: string }) {
    for (const name in defs) {
      if (this.defs.has(name))
        throw new Error(`Duplicated grammar name: ${name}`);
      this.defs.set(name, defs[name]);
    }
    return this;
  }

  /**
   * Build a parser.
   */
  compile() {
    if (!this.lexer) throw new Error("Missing lexer");

    return new Parser(this.lexer, this.getLR());
  }

  /**
   * Check grammar errors and return naive LR.
   */
  private getLR() {
    let grammarLexer = Lexer.ignore(/^\s/).define({
      grammar: /^\w+/, // non-terminator or terminator
      priority: /^@\d+/, // for grammar rule
    });

    let ntNameSet: Set<string> = new Set(); // non-terminator definitions
    let grammarRules: GrammarRule[] = []; // for naive LR

    // construct grammar rules, gather ntNameSet
    this.defs.forEach((grammarStr, ntName) => {
      ntNameSet.add(ntName); // register new NT

      grammarStr
        .split("|") // get all rule strings from one grammar string
        .map((s) => s.trim())
        .filter((s) => s.length)
        .map((ruleStr) => {
          let grammarRule: GrammarRule = {
            rule: [],
            NT: ntName,
            conflicts: [],
            priority: -1,
          };
          grammarLexer
            .reset()
            .feed(ruleStr)
            .apply((t) => {
              if (t.type == "grammar") {
                grammarRule.rule.push(t.content);
              } else {
                // t.type == 'priority'
                if (grammarRule.priority == -1)
                  grammarRule.priority = parseInt(t.content.slice(1));
                else
                  throw new Error(
                    `Duplicate priority hint for rule '${ntName}=>${ruleStr}'`
                  );
              }
            });

          if (!grammarLexer.isDone())
            throw new Error(`Can't tokenize: ${grammarLexer.getRest()}`);

          if (grammarRule.rule.length == 0)
            throw new Error(`No grammar rules in rule '${ntName}=>${ruleStr}'`);

          grammarRules.push(grammarRule);
        });
    });

    // NTs can't have same name with Ts
    let tNameSet = this.lexer.getTokenTypes(); // terminator definitions
    ntNameSet.forEach((name) => {
      if (tNameSet.has(name)) throw new Error(`Duplicated definition: ${name}`);
    });

    // calculate conflicts
    for (let i = 0; i < grammarRules.length - 1; i++) {
      const a = grammarRules[i];
      for (let j = i + 1; j < grammarRules.length; j++) {
        const b = grammarRules[j];

        let conflict = hasConflict(a.rule, b.rule);
        if (conflict != null) {
          setConflict(a, b, conflict);
        }
        // reverse check
        conflict = hasConflict(b.rule, a.rule);
        if (conflict != null && conflict.type !== ConflictType.RR) {
          setConflict(b, a, conflict);
        }
      }
    }

    return new NaiveLR(grammarRules);
  }
}

/**
 * Return conflict type or `null`.
 *
 * Conflict condition:
 *
 * 1. Rule A is Rule B's tail or vice versa, e.g. `a b c` and `b c`, a.k.a: reduce/reduce conflict.
 * 2. Part of rule A's tail are part of rule B's head, e.g. `a b c` and `b c d`, a.k.a: shift/reduce conflict.
 *
 * **IMPORTANT**:
 * Since condition 2 is not reversible, `hasConflict(a,b)` and `hasConflict(b,a)` will return different value.
 */
function hasConflict(a: string[], b: string[]) {
  // check condition 1
  let long = a.length > b.length ? a : b;
  let short = a.length > b.length ? b : a;
  if (shortIsTailOfLong(long, short))
    // reduce/reduce conflict, no need lookahead
    return { type: ConflictType.RR };

  // check condition 2
  for (let i = 1; i <= b.length; i++) {
    // check whether B's head if tail of A
    let bHead = b.slice(0, i);
    if (bHead.length > a.length) return null; // no conflict
    if (shortIsTailOfLong(a, bHead))
      // shift/reduce conflict, need lookahead
      return { type: ConflictType.SR, lookahead: b.length - bHead.length };
  }

  return null;
}

function shortIsTailOfLong(long: string[], short: string[]) {
  for (let i = -1; i >= -short.length; i--) {
    if (short.at(i) != long.at(i)) {
      return false;
    }
  }
  return true;
}

function setConflict(
  a: GrammarRule,
  b: GrammarRule,
  conflict: { type: ConflictType; lookahead?: number }
) {
  const ruleA = `${a.NT} := ${a.rule.join(" ")}`;
  const ruleB = `${b.NT} := ${b.rule.join(" ")}`;

  if (a.priority == -1 || b.priority == -1)
    throw new Error(
      `Rule "${ruleA}" and rule "${ruleB}" are conflict but missing priority hint`
    );

  if (a.priority == b.priority)
    throw new Error(
      `Rule "${ruleA}" and rule "${ruleB}" are conflict but have the same priority`
    );

  if (a.priority > b.priority) b.conflicts.push({ rule: a, ...conflict });
  else a.conflicts.push({ rule: b, ...conflict });
}
