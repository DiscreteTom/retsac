import { Definition, ILexer, Token } from "./model";

/** Transform text string to a token list. */
export class Lexer implements ILexer {
  private readonly defs: readonly Definition[];
  private buffer: string;
  /** How many chars are digested. */
  private offset: number;
  /** How many chars in each line. */
  private lineChars: number[];
  /** Error token list. */
  private errors: Token[];

  constructor(defs: readonly Definition[]) {
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

  /** Clone a new lexer with the same state. */
  clone() {
    const res = new Lexer(this.defs);
    res.buffer = this.buffer;
    res.offset = this.offset;
    res.lineChars = [...this.lineChars];
    res.errors = [...this.errors];
    return res;
  }

  /** Clone a new lexer with the same definitions. */
  dryClone() {
    return new Lexer(this.defs);
  }

  /** Append buffer with input. */
  feed(input: string) {
    this.buffer += input;
    return this;
  }

  /**
   * Take `n` chars from buffer and update state.
   */
  take(n = 1) {
    // update this state
    const content = this.buffer.slice(0, n);
    this.buffer = this.buffer.slice(n);
    this.offset += n;
    // calculate line chars
    content.split("\n").map((part, i, list) => {
      this.lineChars[this.lineChars.length - 1] += part.length;
      if (i != list.length - 1) {
        this.lineChars[this.lineChars.length - 1]++; // add '\n'
        this.lineChars.push(0); // new line with 0 chars
      }
    });

    return content;
  }

  /**
   * Try to retrieve a token. If nothing match, return `null`.
   *
   * You can provide `expect` to limit the token types to be accepted.
   */
  lex(
    input:
      | string
      | Readonly<{
          input?: string;
          expect?: ReadonlySet<string> | readonly string[];
        }> = ""
  ): Token | null {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input.input) this.feed(input.input);
    }

    // calculate expect
    const expect =
      typeof input === "string"
        ? undefined
        : input.expect
        ? input.expect instanceof Array
          ? new Set(input.expect)
          : input.expect
        : undefined;

    if (this.buffer.length == 0) return null;

    while (true) {
      let mute = false;
      for (const def of this.defs) {
        // if user provide expect, skip unmatched type
        if (expect && !expect.has(def.type)) continue;

        const res = def.action.exec(this.buffer);
        if (res.accept) {
          // update this state
          const content = this.take(res.digested);

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
  lexAll(input = "", stopOnError = false): Token[] {
    this.feed(input);

    const result: Token[] = [];
    while (true) {
      const res = this.lex();
      if (res) {
        result.push(res);
        if (stopOnError && res.error) break;
      } else break;
    }
    return result;
  }

  /**
   * Remove ignored chars from the start of the buffer.
   */
  trimStart(input = "") {
    this.feed(input);

    while (true) {
      if (this.buffer.length == 0) return this;
      let mute = false;
      for (const def of this.defs) {
        const res = def.action.exec(this.buffer);
        if (res.accept) {
          if (!res.mute) {
            // next token is not muted
            // don't update state, just return
            return this;
          }

          // next token is muted, update this state
          const content = this.take(res.digested);

          // construct token
          const token: Token = {
            type: def.type,
            content,
            start: this.offset - content.length,
            error: res.error,
          };

          // collect errors
          if (token.error) this.errors.push(token);

          // since muted, re-loop all definitions
          mute = true;
          break;
        }
        // not accept, try next def
      }
      if (!mute)
        // all definition checked, no accept
        return this;
      // else, muted, re-loop all definitions
    }
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
