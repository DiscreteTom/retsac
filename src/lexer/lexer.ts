import { Definition, ILexer, Token } from "./model";

/** Extract tokens from the input string. */
export class Lexer implements ILexer {
  private readonly defs: readonly Definition[];
  /** Only `feed`, `reset` can modify this var. */
  private buffer: string;
  /**
   * The un-digested string.
   * This var is used to cache the result of `buffer.slice(offset)` to prevent unnecessary string copy.
   * Only `feed`, `reset`, `update` can modify this var.
   */
  private rest: string;
  /**
   * How many chars are digested.
   * Only `update`, `reset` can modify this var.
   */
  private offset: number;
  /**
   * How many chars in each line.
   * Only `update`, `reset` can modify this var.
   */
  private lineChars: number[];
  /** Error token list. */
  private errors: Token[];

  constructor(defs: readonly Definition[]) {
    this.defs = defs;
    this.reset();
  }

  reset() {
    this.buffer = "";
    this.rest = "";
    this.offset = 0;
    this.lineChars = [0];
    this.errors = [];
    return this;
  }

  clone() {
    const res = new Lexer(this.defs);
    res.buffer = this.buffer;
    res.rest = this.rest;
    res.offset = this.offset;
    res.lineChars = [...this.lineChars];
    res.errors = [...this.errors];
    return res;
  }

  dryClone() {
    return new Lexer(this.defs);
  }

  feed(input: string) {
    this.buffer += input;
    this.rest = this.buffer.slice(this.offset);
    return this;
  }

  get digested() {
    return this.offset;
  }

  take(n = 1) {
    const content = this.rest.slice(0, n);
    const rest = this.rest.slice(n);

    this.update(n, content, rest);
    return content;
  }

  private update(digested: number, content: string, rest: string) {
    this.offset += digested;
    this.rest = rest;
    // calculate line chars
    content.split("\n").forEach((part, i, list) => {
      this.lineChars[this.lineChars.length - 1] += part.length;
      if (i != list.length - 1) {
        this.lineChars[this.lineChars.length - 1]++; // add '\n'
        this.lineChars.push(0); // new line with 0 chars
      }
    });
    return this;
  }

  lex(
    input:
      | string
      | Readonly<{
          input?: string;
          expect?: Readonly<{
            type?: string;
            text?: string;
          }>;
        }> = ""
  ): Token | null {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input?.input) this.feed(input.input);
    }

    // calculate expect
    const expect = {
      type: typeof input === "string" ? undefined : input?.expect?.type,
      text: typeof input === "string" ? undefined : input?.expect?.text,
    };

    if (!this.hasRest()) return null;

    while (true) {
      let muted = false;
      for (const def of this.defs) {
        const res = def.action.exec(this.rest);
        if (
          res.accept &&
          // if user provide expected type, reject unmatched type
          (!expect.type ||
            expect.type == def.type ||
            // but if the unmatched type is muted (e.g. ignored), accept it
            res.muted) &&
          // if user provide expected text, reject unmatched text
          (!expect.text ||
            expect.text == res.content ||
            // but if the unmatched text is muted (e.g. ignored), accept it
            res.muted)
        ) {
          // update this state
          this.update(res.digested, res.content, res.rest);

          // construct token
          const content = res.content;
          const token: Token = {
            type: def.type,
            content,
            start: this.offset - content.length,
            error: res.error,
          };

          // collect errors
          if (token.error) this.errors.push(token);

          if (!res.muted) {
            // emit token
            return token;
          } else {
            // mute, re-loop all definitions
            muted = true;
            break;
          }
        }
        // not accept, try next def
      }
      if (!muted)
        // all definition checked, no accept
        return null;
      // else, muted, re-loop all definitions
    }
  }

  lexAll(
    input: string | { input?: string; stopOnError?: boolean } = ""
  ): Token[] {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input?.input) this.feed(input.input);
    }

    const stopOnError =
      typeof input === "string" ? false : input?.stopOnError ?? false;

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

  trimStart(input = "") {
    this.feed(input);

    while (true) {
      if (!this.hasRest()) return this;
      let mute = false;
      for (const def of this.defs) {
        const res = def.action.exec(this.rest);
        if (res.accept) {
          if (!res.muted) {
            // next token is not muted
            // don't update state, just return
            return this;
          }

          // next token is muted, update this state
          this.update(res.digested, res.content, res.rest);

          // construct token
          const content = res.content;
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

  getRest() {
    return this.rest;
  }

  hasRest() {
    return this.rest.length != 0;
  }

  getTokenTypes() {
    const res: Set<string> = new Set();
    this.defs.forEach((d) => res.add(d.type));
    return res;
  }

  getLineChars(): readonly number[] {
    return this.lineChars;
  }

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

  getErrors(): readonly Token[] {
    return this.errors;
  }

  hasErrors() {
    return this.errors.length != 0;
  }
}
