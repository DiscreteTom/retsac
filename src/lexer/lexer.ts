import { Action, ActionSource } from "./action";

/** The output of a lexer. */
export type Token = {
  /** User-defined type name. */
  type: string;
  /** Text content. */
  content: string;
  /** Start position of input string. */
  start: number;
  /** Error message. `null` if no error. */
  error: any;
};

/** Apply `action` and try to yield a token with `type`. */
export type Definition = {
  /** Target token type. Empty string if anonymous. */
  type: string;
  action: Action;
};

/** Transform text string to a token list. */
export class Lexer {
  private defs: Definition[];
  private buffer: string;
  /** How many chars are digested. */
  private offset: number;
  /** How many chars in each line. */
  private lineChars: number[];
  private errors: Token[];

  constructor() {
    this.defs = [];
    this.buffer = "";
    this.offset = 0;
    this.lineChars = [0];
    this.errors = [];
  }

  reset() {
    this.buffer = "";
    this.offset = 0;
    this.lineChars = [0];
    this.errors = [];
    return this;
  }

  /**
   * Define token types.
   */
  define(defs: { [type: string]: ActionSource }) {
    for (const type in defs) {
      this.defs.push({
        type,
        action: Action.from(defs[type]),
      });
    }
    return this;
  }

  /**
   * Define anonymous tokens.
   */
  anonymous(...actions: ActionSource[]) {
    actions.map((a) => this.define({ "": a }));
    return this;
  }

  /**
   * Define muted anonymous action.
   */
  ignore(...r: ActionSource[]) {
    r.map((s) => this.define({ "": Action.from(s).mute() }));
    return this;
  }

  /**
   * Define a type with multiple action.
   */
  overload(defs: { [type: string]: ActionSource[] }) {
    for (const type in defs) {
      defs[type].map((action) => {
        let def: { [type: string]: ActionSource } = {};
        def[type] = action;
        this.define(def);
      });
    }
    return this;
  }

  /** Append buffer with input. */
  feed(input: string) {
    this.buffer += input;
    return this;
  }

  /**
   * Try to retrieve a token. If nothing match, return `null`.
   */
  lex(input = ""): Token {
    this.feed(input);
    if (this.buffer.length == 0) return null;

    while (true) {
      let mute = false;
      for (const def of this.defs) {
        let res = def.action.exec(this.buffer);
        if (res.accept) {
          // update this state
          const content = this.buffer.slice(0, res.digested);
          this.buffer = this.buffer.slice(res.digested);
          this.offset += content.length;
          content.split("\n").map((part, i, list) => {
            this.lineChars[this.lineChars.length - 1] += part.length;
            if (i != list.length - 1) {
              this.lineChars[this.lineChars.length - 1]++; // add '\n'
              this.lineChars.push(0);
            }
          });

          // construct token
          const token: Token = {
            type: def.type,
            content,
            start: this.offset - content.length,
            error: res.error,
          };

          // collect errors
          if (token.error) this.errors.push(token);

          if (!res.mute) {
            // emit token
            return token;
          } else {
            // mute, re-loop all definitions
            mute = true;
            break;
          }
        }
      }
      if (!mute)
        // all definition checked, no accept
        return null;
    }
  }

  /**
   * Try to retrieve a token list.
   */
  lexAll(input = "") {
    this.feed(input);

    let result: Token[] = [];
    while (true) {
      let res = this.lex();
      if (res) result.push(res);
      else break;
    }
    return result;
  }

  /**
   * Get the rest string buffer.
   */
  getRest() {
    return this.buffer;
  }

  /**
   * Buffer not empty.
   */
  hasRest() {
    return this.buffer.length != 0;
  }

  getTokenTypes() {
    let res: Set<string> = new Set();
    this.defs.map((d) => res.add(d.type));
    return res;
  }

  /**
   * Get how many chars in each line.
   */
  getLineChars() {
    return this.lineChars;
  }

  /**
   * Get line number (starts from 1) and column number (starts from 1)
   * from the index (starts from 0) of the input string.
   */
  getPos(index: number): { line: number; column: number } {
    let result = { line: 1, column: 1 };
    for (const n of this.lineChars) {
      if (index >= n) {
        index -= n;
        result.line++;
      } else {
        result.column += index;
        break;
      }
    }
    return result;
  }

  /**
   * Get error tokens.
   */
  getErrors() {
    return this.errors;
  }

  hasError() {
    return this.errors.length != 0;
  }
}
