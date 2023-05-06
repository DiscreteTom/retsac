import { Logger } from "../model";
import { ActionAcceptedOutput } from "./action";
import { Definition, ILexer, LexerBuildOptions, Token } from "./model";

/** Extract tokens from the input string. */
export class Lexer implements ILexer {
  debug: boolean;
  logger: Logger;
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

  constructor(defs: readonly Definition[], options?: LexerBuildOptions) {
    this.defs = defs;
    this.debug = options?.debug ?? false;
    this.logger = options?.logger ?? console.log;
    this.reset();
  }

  private log(msg: string) {
    if (this.debug) this.logger(msg);
  }

  reset() {
    this.log(`[Lexer.reset]`);
    this.buffer = "";
    this.rest = "";
    this.offset = 0;
    this.lineChars = [0];
    this.errors = [];
    return this;
  }

  dryClone(options?: { debug?: boolean; logger?: Logger }) {
    const res = new Lexer(this.defs);
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
    return res;
  }

  clone(options?: { debug?: boolean; logger?: Logger }) {
    const res = this.dryClone(options);
    res.buffer = this.buffer;
    res.rest = this.rest;
    res.offset = this.offset;
    res.lineChars = [...this.lineChars];
    res.errors = [...this.errors];
    return res;
  }

  feed(input: string) {
    if (input.length > 0) this.log(`[Lexer.feed] ${input.length} chars`);
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

    if (n > 0) this.log(`[Lexer.take] ${n} chars: ${JSON.stringify(content)}`);

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

  private res2token(res: ActionAcceptedOutput, def: Definition): Token {
    return {
      type: def.type,
      content: res.content,
      start: this.offset - res.content.length,
      error: res.error,
    };
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

    if (expect.type || expect.text)
      this.log(`[Lexer.lex] expect ${JSON.stringify(expect)}`);

    while (true) {
      // first, check rest
      // since maybe some token is muted which cause the rest is empty
      if (!this.hasRest()) {
        this.log(`[Lexer.lex] no rest`);
        return null;
      }

      let muted = false;
      for (const def of this.defs) {
        // if user provide expected type, ignore unmatched type, unless it's muted.
        // so if an action is never muted, we can skip it safely
        if (
          !def.action.maybeMuted &&
          expect.type !== undefined &&
          def.type != expect.type
        ) {
          this.log(
            `[Lexer.lex] skip ${
              def.type || "<anonymous>"
            } (not-maybe-muted or unexpected)`
          );
          continue;
        }

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
          this.log(
            `[Lexer.lex] accept ${def.type || "<anonymous>"}: ${JSON.stringify(
              res.content
            )}`
          );
          // update this state
          this.update(res.digested, res.content, res.rest);

          // construct token
          const token = this.res2token(res, def);

          // collect errors
          if (token.error) this.errors.push(token);

          if (!res.muted) {
            // emit token
            return token;
          } else {
            // accept but muted, don't emit token, re-loop all definitions
            muted = true;
            break;
          }
        } else {
          // not accept, try next def
          if (!res.accept)
            this.log(`[Lexer.lex] rejected: ${def.type || "<anonymous>"}`);
          // this won't happen, res.muted is always false here
          // else if (res.muted)
          //   this.log(
          //     `[Lexer.lex] muted: ${
          //       def.type || "<anonymous>"
          //     } content: ${JSON.stringify(res.content)}`
          //   );
          else
            this.log(
              `[Lexer.lex] unexpected: ${JSON.stringify({
                type: def.type,
                content: res.content,
              })}`
            );
        }
      }
      if (!muted) {
        // all definition checked, no accept
        this.log(`[Lexer.lex] no accept`);
        return null;
      }
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
      if (!this.hasRest()) {
        this.log(`[Lexer.trimStart] no rest`);
        return this;
      }
      let mute = false;
      for (const def of this.defs) {
        // if def is not mute-able, ignore it
        if (!def.action.maybeMuted) {
          this.log(
            `[Lexer.trimStart] skip ${
              def.type || "<anonymous>"
            } (not-maybe-muted)`
          );
          continue;
        }

        const res = def.action.exec(this.rest);
        if (res.accept) {
          if (!res.muted) {
            // next token is not muted
            // don't update state, just return
            this.log(
              `[Lexer.trimStart] not muted: ${
                def.type || "<anonymous>"
              }, return`
            );
            return this;
          }

          this.log(
            `[Lexer.trimStart] trim: ${
              def.type || "<anonymous>"
            } content: ${JSON.stringify(res.content)}`
          );

          // next token is muted, update this state
          this.update(res.digested, res.content, res.rest);

          // construct token
          const token = this.res2token(res, def);

          // collect errors
          if (token.error) this.errors.push(token);

          // since muted, re-loop all definitions
          mute = true;
          break;
        } else {
          // not accept, try next def
          this.log(`[Lexer.trimStart] rejected: ${def.type || "<anonymous>"}`);
        }
      }
      if (!mute) {
        // all definition checked, no accept
        this.log(`[Lexer.trimStart] no accept`);
        return this;
      }
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
