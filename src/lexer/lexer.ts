import { Definition, Token } from "./model";

/** Transform text string to a token list. */
export class Lexer {
  private defs: Definition[];
  private buffer: string;
  /** How many chars are digested. */
  private offset: number;
  /** How many chars in each line. */
  private lineChars: number[];
  /** Error token list. */
  private errors: Token[];

  constructor(defs: Definition[]) {
    this.defs = defs;
    this.reset();
  }

  reset() {
    this.buffer = "";
    this.offset = 0;
    this.lineChars = [0];
    this.errors = [];
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
  lex(input = ""): Token | null {
    this.feed(input);
    if (this.buffer.length == 0) return null;

    while (true) {
      let mute = false;
      for (const def of this.defs) {
        const res = def.action.exec(this.buffer);
        if (res.accept) {
          // update this state
          const content = this.buffer.slice(0, res.digested);
          this.buffer = this.buffer.slice(res.digested);
          this.offset += content.length;
          // calculate line chars
          content.split("\n").map((part, i, list) => {
            this.lineChars[this.lineChars.length - 1] += part.length;
            if (i != list.length - 1) {
              this.lineChars[this.lineChars.length - 1]++; // add '\n'
              this.lineChars.push(0); // new line with 0 chars
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
        // not accept, try next def
      }
      if (!mute)
        // all definition checked, no accept
        return null;
      // else, muted, re-loop all definitions
    }
  }

  /**
   * Try to retrieve a token list.
   */
  lexAll(input = "") {
    this.feed(input);

    const result: Token[] = [];
    while (true) {
      const res = this.lex();
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

  /**
   * Get all defined token types.
   */
  getTokenTypes() {
    const res: Set<string> = new Set();
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
    const result = { line: 1, column: 1 };
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
