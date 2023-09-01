import { Logger } from "../model";
import { AcceptedActionOutput, ActionInput } from "./action";
import { LexerBuildOptions } from "./builder";
import { InvalidLengthForTakeError } from "./error";
import { Definition, ILexer, Token } from "./model";
import { esc4regex } from "./utils";

/** Extract tokens from the input string. */
export class Lexer<E> implements ILexer<E> {
  debug: boolean;
  logger: Logger;
  private readonly defs: readonly Readonly<Definition<E>>[];
  /** Only `feed`, `reset` can modify this var. */
  private buffer: string;
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
  private errors: Token<E>[];
  /**
   * Cache whether this lexer already trim start.
   * Only `update`, `feed`, `reset`, `trimStart` can modify this var.
   */
  private trimmed: boolean;
  /**
   * This is lazy and cached.
   * Only `update`, `reset` and `feed` can modify this var.
   */
  private rest?: string;

  constructor(
    defs: readonly Readonly<Definition<E>>[],
    options?: LexerBuildOptions
  ) {
    this.defs = defs;
    this.debug = options?.debug ?? false;
    this.logger = options?.logger ?? console.log;
    this.reset();
  }

  /**
   * Log message if debug.
   * Use factory to prevent unnecessary string concat.
   */
  private log(factory: () => string) {
    if (this.debug) this.logger(factory());
  }

  reset() {
    this.log(() => `[Lexer.reset]`);
    this.buffer = "";
    this.offset = 0;
    this.lineChars = [0];
    this.errors = [];
    this.trimmed = true; // no input yet, so no need to trim
    this.rest = undefined;
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
    res.offset = this.offset;
    res.lineChars = [...this.lineChars];
    res.errors = [...this.errors];
    res.trimmed = this.trimmed;
    res.rest = this.rest;
    return res;
  }

  feed(input: string) {
    if (input.length > 0) this.log(() => `[Lexer.feed] ${input.length} chars`);
    this.buffer += input;
    this.trimmed = false; // maybe the new feed chars can construct a new token
    this.rest = undefined; // clear cache
    return this;
  }

  get digested() {
    return this.offset;
  }

  take(n = 1) {
    const content = this.buffer.slice(this.offset, this.offset + n);

    if (n > 0)
      // stringify to escape '\n'
      this.log(() => `[Lexer.take] ${n} chars: ${JSON.stringify(content)}`);
    else throw new InvalidLengthForTakeError(n);

    this.update(n, content);
    return content;
  }

  takeUntil(
    pattern: string | RegExp,
    options?: {
      autoGlobal?: boolean;
    }
  ) {
    let regex =
      typeof pattern === "string" ? new RegExp(esc4regex(pattern)) : pattern;
    if ((options?.autoGlobal ?? true) && !regex.global && !regex.sticky)
      regex = new RegExp(regex.source, regex.flags + "g");

    regex.lastIndex = this.offset;
    const res = regex.exec(this.buffer);

    if (!res || res.index == -1) {
      this.log(() => `[Lexer.takeUntil] no match with regex ${regex}`);
      return "";
    }

    const content = this.buffer.slice(this.offset, res.index + 1);
    this.log(
      () =>
        `[Lexer.takeUntil] ${content.length} chars: ${JSON.stringify(content)}`
    );
    this.update(content.length, content);
    return content;
  }

  /** Update inner states. */
  private update(digested: number, content: string) {
    this.offset += digested;
    this.trimmed = this.offset == this.buffer.length; // if all chars are digested, no need to trim
    this.rest = undefined; // clear cache
    // calculate line chars
    // `split` is faster than iterate all chars
    content.split("\n").forEach((part, i, list) => {
      this.lineChars[this.lineChars.length - 1] += part.length;
      if (i != list.length - 1) {
        this.lineChars[this.lineChars.length - 1]++; // add '\n'
        this.lineChars.push(0); // new line with 0 chars
      }
    });
    return this;
  }

  private res2token(
    res: Readonly<AcceptedActionOutput<E>>,
    def: Readonly<Definition<E>>
  ): Token<E> {
    return {
      type: def.type,
      content: res.content,
      start: res.start,
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
  ): Token<E> | null {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input.input) this.feed(input.input);
    }

    // calculate expect
    const expect = {
      type: typeof input === "string" ? undefined : input.expect?.type,
      text: typeof input === "string" ? undefined : input.expect?.text,
    };

    if (expect.type || expect.text)
      this.log(() => `[Lexer.lex] expect ${JSON.stringify(expect)}`);

    while (true) {
      // first, check rest
      // since maybe some token is muted which cause the rest is empty in the last iteration
      if (!this.hasRest()) {
        this.log(() => `[Lexer.lex] no rest`);
        return null;
      }

      let muted = false;
      // all defs will reuse this input to reuse lazy values
      const input = new ActionInput({
        buffer: this.buffer,
        start: this.offset,
        rest: this.rest,
      });
      for (const def of this.defs) {
        // if user provide expected type, ignore unmatched type, unless it's muted(still can be digested but not emit).
        // so if an action is never muted, we can skip it safely
        if (
          // never muted, so we can check the expectation
          !def.action.maybeMuted &&
          // expectation mismatch
          ((expect.type !== undefined && def.type != expect.type) ||
            (expect.text !== undefined &&
              !this.buffer.startsWith(expect.text, this.offset)))
        ) {
          this.log(
            () =>
              `[Lexer.lex] skip ${
                def.type || "<anonymous>"
              } (unexpected and never muted)`
          );
          continue; // try next def
        }

        const res = def.action.exec(input);
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
            () =>
              `[Lexer.lex] accept ${def.type || "<anonymous>"}${
                res.muted ? "(muted)" : ""
              }: ${JSON.stringify(res.content)}`
          );
          // update this state
          this.update(res.digested, res.content);

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
            break; // break the iteration of definitions
          }
        } else {
          // not accept or unexpected

          // if not accept, try next def
          if (!res.accept) {
            this.log(
              () => `[Lexer.lex] rejected: ${def.type || "<anonymous>"}`
            );
          }
          // below won't happen, res.muted is always false here
          // else if (res.muted)
          //   this.log(
          //     `[Lexer.lex] muted: ${
          //       def.type || "<anonymous>"
          //     } content: ${JSON.stringify(res.content)}`
          //   );
          else {
            // unexpected, try next def
            this.log(
              () =>
                `[Lexer.lex] unexpected: ${JSON.stringify({
                  type: def.type,
                  content: res.content,
                })}`
            );
          }
        }
      } // end of defs iteration
      if (!muted) {
        // all definition checked, no accept or muted
        this.log(() => `[Lexer.lex] no accept`);
        return null;
      }
      // else, muted, re-loop all definitions
    }
  }

  lexAll(
    input: string | { input?: string; stopOnError?: boolean } = ""
  ): Token<E>[] {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input.input) this.feed(input.input);
    }

    const stopOnError =
      typeof input === "string" ? false : input.stopOnError ?? false;

    const result: Token<E>[] = [];
    while (true) {
      const res = this.lex();
      if (res != null) {
        result.push(res);
        if (stopOnError && res.error) break;
      } else break;
    }
    return result;
  }

  trimStart(input = "") {
    this.feed(input);

    while (true) {
      // when no rest, this.trimmed is set to true by this.update
      if (this.trimmed) return this;

      let mute = false;
      // all defs will reuse this input to reuse lazy values
      const input = new ActionInput({
        buffer: this.buffer,
        start: this.offset,
        rest: this.rest,
      });
      for (const def of this.defs) {
        // if def is never muted, ignore it
        if (!def.action.maybeMuted) {
          this.log(
            () =>
              `[Lexer.trimStart] skip ${
                def.type || "<anonymous>"
              } (never muted)`
          );
          continue;
        }

        const res = def.action.exec(input);
        if (res.accept) {
          if (!res.muted) {
            // next token is not muted
            // don't update state, just return
            this.log(
              () =>
                `[Lexer.trimStart] not muted: ${
                  def.type || "<anonymous>"
                }, stop trimming`
            );
            this.trimmed = true;
            return this;
          }

          // else, muted
          this.log(
            () =>
              `[Lexer.trimStart] trim: ${
                def.type || "<anonymous>"
              } content: ${JSON.stringify(res.content)}`
          );

          // next token is muted, update this state
          this.update(res.digested, res.content);

          // construct token
          const token = this.res2token(res, def);

          // collect errors
          if (token.error) this.errors.push(token);

          // since muted, re-loop all definitions
          mute = true;
          break;
        } else {
          // not accept, try next def
          this.log(
            () => `[Lexer.trimStart] rejected: ${def.type || "<anonymous>"}`
          );
        }
      }
      if (!mute) {
        // all definition checked, no accept
        this.log(() => `[Lexer.trimStart] no accept`);
        this.trimmed = true;
        return this;
      }
      // else, muted, re-loop all definitions
    }
  }

  getRest() {
    return this.rest ?? (this.rest = this.buffer.slice(this.offset));
  }

  hasRest() {
    return this.offset < this.buffer.length;
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

  getErrors(): readonly Token<E>[] {
    return this.errors;
  }

  hasErrors() {
    return this.errors.length != 0;
  }
}
