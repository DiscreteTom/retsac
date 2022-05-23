import { Lexer, Token } from "../lexer/lexer";
import { Grammar, NaiveLR } from "./naive_LR";

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

    let lr = this.getLR();
    return new Parser(this.lexer, lr);
  }

  /**
   * Check grammar errors and return naive LR.
   */
  private getLR() {
    let grammarLexer = Lexer.ignore(/^\s/).define({
      grammar: /^\w+/, // non-terminator or terminator
    });

    let grammarSet: Set<string> = new Set(); // terminators and non-terminators in grammar string
    let ntNameSet: Set<string> = new Set(); // non-terminator definitions
    let grammars: Grammar[] = []; // for naive LR

    this.defs.forEach((grammarStr, ntName) => {
      ntNameSet.add(ntName);

      grammarStr
        .split("|")
        .map((s) => s.trim())
        .filter((s) => s.length)
        .map((g) => {
          let grammar: Grammar = {
            rule: [],
            type: ntName,
          };
          grammarLexer
            .reset()
            .feed(g)
            .apply((t) => {
              grammar.rule.push(t.content);
              grammarSet.add(t.content);
            });

          if (!grammarLexer.isDone())
            throw new Error(`Can't tokenize: ${grammarLexer.getRest()}`);

          grammars.push(grammar);
        });
    });

    // NTs can't have same name with Ts
    let tokenTypeSet = this.lexer.getTokenTypes(); // terminator definitions
    ntNameSet.forEach((name) => {
      if (tokenTypeSet.has(name))
        throw new Error(`Duplicated definition: ${name}`);
    });

    // separate terminator / non-terminator
    // let Ts: string[] = [];
    // let NTs: string[] = [];
    // grammarSet.forEach((grammar) => {
    //   if (!nameSet.has(grammar)) NTs.push(grammar);
    //   else if (!tokenTypeSet.has(grammar)) Ts.push(grammar);
    //   else throw new Error(`Missing definition: ${grammar}`);
    // });

    return new NaiveLR(grammars);
  }
}

/**
 * Parser can parse input string to AST.
 */
export class Parser {
  private lexer: Lexer;
  private lr: NaiveLR;

  constructor(lexer: Lexer, lr: NaiveLR) {
    this.lexer = lexer;
    this.lr = lr;
  }

  reset() {
    this.lexer.reset();
    this.lr.reset();
  }

  parse(s: string) {
    this.lexer.feed(s);
    this.lexer.apply((t) => {
      this.lr.feedOne(t);
    });
    return this.lr.getBuffer();
  }

  getBuffer() {
    return this.lr.getBuffer();
  }
}
