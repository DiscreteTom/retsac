import { Logger } from "../model";
import { AcceptedActionOutput, ActionInput } from "./action";
import { LexerBuildOptions } from "./builder";
import { InvalidLengthForTakeError } from "./error";
import { Definition, ILexer, Token } from "./model";
import { esc4regex } from "./utils";

/** Extract tokens from the input string. */
export class Lexer<ErrorType, Kinds extends string>
  implements ILexer<ErrorType, Kinds>
{
  debug: boolean;
  logger: Logger;
  readonly errors: Token<ErrorType, Kinds>[];
  readonly defs: readonly Readonly<Definition<ErrorType, Kinds>>[];
  /** Only `feed`, `reset` can modify this var. */
  private _buffer: string;
  /**
   * How many chars are digested.
   * Only `update`, `reset` can modify this var.
   */
  private _digested: number;
  /**
   * How many chars in each line.
   * Only `update`, `reset` can modify this var.
   */
  private _lineChars: number[];
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
    defs: readonly Readonly<Definition<ErrorType, Kinds>>[],
    options?: LexerBuildOptions
  ) {
    this.defs = defs;
    this.debug = options?.debug ?? false;
    this.logger = options?.logger ?? console.log;
    this.errors = [];
    this.reset();
  }

  get buffer() {
    return this._buffer;
  }

  get digested() {
    return this._digested;
  }

  get lineChars(): readonly number[] {
    return this._lineChars;
  }

  reset() {
    if (this.debug) this.logger(`[Lexer.reset]`);
    this._buffer = "";
    this._digested = 0;
    this._lineChars = [0];
    this.errors.length = 0;
    this.trimmed = true; // no input yet, so no need to trim
    this.rest = undefined;
    return this;
  }

  dryClone(options?: { debug?: boolean; logger?: Logger }) {
    const res = new Lexer<ErrorType, Kinds>(this.defs);
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
    return res;
  }

  clone(options?: { debug?: boolean; logger?: Logger }) {
    const res = this.dryClone(options);
    res._buffer = this._buffer;
    res._digested = this._digested;
    res._lineChars = [...this._lineChars];
    res.errors.push(...this.errors);
    res.trimmed = this.trimmed;
    res.rest = this.rest;
    return res;
  }

  feed(input: string) {
    if (input.length == 0) return this;
    if (this.debug) this.logger(`[Lexer.feed] ${input.length} chars`);
    this._buffer += input;
    this.trimmed = false; // maybe the new feed chars can construct a new token
    this.rest = undefined; // clear cache
    return this;
  }

  take(n = 1) {
    const content = this._buffer.slice(this._digested, this._digested + n);

    if (n > 0) {
      if (this.debug)
        // stringify to escape '\n'
        this.logger(`[Lexer.take] ${n} chars: ${JSON.stringify(content)}`);
    } else throw new InvalidLengthForTakeError(n);

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

    regex.lastIndex = this._digested;
    const res = regex.exec(this._buffer);

    if (!res || res.index == -1) {
      if (this.debug)
        this.logger(`[Lexer.takeUntil] no match with regex ${regex}`);
      return "";
    }

    const content = this._buffer.slice(this._digested, res.index + 1);
    if (this.debug)
      this.logger(
        `[Lexer.takeUntil] ${content.length} chars: ${JSON.stringify(content)}`
      );
    this.update(content.length, content);
    return content;
  }

  /** Update inner states. */
  private update(digested: number, content: string, rest?: string) {
    this._digested += digested;
    this.trimmed = this._digested == this._buffer.length; // if all chars are digested, no need to trim
    this.rest = rest;
    // calculate line chars
    // `split` is faster than iterate all chars
    content.split("\n").forEach((part, i, list) => {
      this._lineChars[this._lineChars.length - 1] += part.length;
      if (i != list.length - 1) {
        this._lineChars[this._lineChars.length - 1]++; // add '\n'
        this._lineChars.push(0); // new line with 0 chars
      }
    });
    return this;
  }

  private res2token(
    res: Readonly<AcceptedActionOutput<ErrorType>>,
    def: Readonly<Definition<ErrorType, Kinds>>
  ): Token<ErrorType, Kinds> {
    return {
      kind: def.kind as Kinds,
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
            kind?: string;
            text?: string;
          }>;
          peek?: boolean;
        }> = ""
  ): Token<ErrorType, Kinds> | null {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input.input) this.feed(input.input);
    }

    // calculate expect & peek
    const expect = {
      kind: typeof input === "string" ? undefined : input.expect?.kind,
      text: typeof input === "string" ? undefined : input.expect?.text,
    };
    const peek = typeof input === "string" ? false : input.peek ?? false;

    // debug output
    if (expect.kind || expect.text) {
      if (this.debug)
        this.logger(
          `[Lexer.lex] expect${peek ? "(peek)" : ""} ${JSON.stringify(expect)}`
        );
    } else {
      if (peek) {
        if (this.debug) this.logger(`[Lexer.lex] peek`);
      }
    }

    let digestedByPeek = 0;
    let peekRest = undefined as undefined | string;
    while (true) {
      // first, check rest
      // since maybe some token is muted which cause the rest is empty in the last iteration
      if (this._digested + digestedByPeek >= this.buffer.length) {
        if (this.debug) this.logger(`[Lexer.lex] no rest`);
        return null;
      }

      let muted = false;
      // all defs will reuse this input to reuse lazy values
      const input = new ActionInput({
        buffer: this._buffer,
        start: this._digested + digestedByPeek,
        rest: digestedByPeek == 0 ? this.rest : peekRest,
      });
      for (const def of this.defs) {
        // if user provide expected kind, ignore unmatched kind, unless it's muted(still can be digested but not emit).
        // so if an action is never muted, we can skip it safely
        if (
          // never muted, so we can check the expectation
          !def.action.maybeMuted &&
          // expectation mismatch
          ((expect.kind !== undefined && def.kind != expect.kind) ||
            (expect.text !== undefined &&
              !this._buffer.startsWith(
                expect.text,
                this._digested + digestedByPeek
              )))
        ) {
          if (this.debug)
            this.logger(
              `[Lexer.lex] skip ${
                def.kind || "<anonymous>"
              } (unexpected and never muted)`
            );
          continue; // try next def
        }

        const res = def.action.exec(input);
        if (
          res.accept &&
          // if user provide expected kind, reject unmatched kind
          (!expect.kind ||
            expect.kind == def.kind ||
            // but if the unmatched kind is muted (e.g. ignored), accept it
            res.muted) &&
          // if user provide expected text, reject unmatched text
          (!expect.text ||
            expect.text == res.content ||
            // but if the unmatched text is muted (e.g. ignored), accept it
            res.muted)
        ) {
          if (this.debug)
            this.logger(
              `[Lexer.lex] accept ${def.kind || "<anonymous>"}${
                res.muted ? "(muted)" : ""
              }: ${JSON.stringify(res.content)}`
            );
          // update this state
          if (!peek) this.update(res.digested, res.content, res._rest);
          else {
            digestedByPeek = res.digested;
            peekRest = res._rest;
          }

          // construct token
          const token = this.res2token(res, def);

          // collect errors
          if (!peek && token.error) this.errors.push(token);

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
            if (this.debug)
              this.logger(`[Lexer.lex] rejected: ${def.kind || "<anonymous>"}`);
          }
          // below won't happen, res.muted is always false here
          // else if (res.muted)
          //   if(this.debug) this.logger(
          //     `[Lexer.lex] muted: ${
          //       def.kind || "<anonymous>"
          //     } content: ${JSON.stringify(res.content)}`
          //   );
          else {
            // unexpected, try next def
            if (this.debug)
              this.logger(
                `[Lexer.lex] unexpected: ${JSON.stringify({
                  kind: def.kind,
                  content: res.content,
                })}`
              );
          }
        }
      } // end of defs iteration
      if (!muted) {
        // all definition checked, no accept or muted
        if (this.debug) this.logger(`[Lexer.lex] no accept`);
        return null;
      }
      // else, muted, re-loop all definitions
    }
  }

  lexAll(
    input: string | { input?: string; stopOnError?: boolean } = ""
  ): Token<ErrorType, Kinds>[] {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input.input) this.feed(input.input);
    }

    const stopOnError =
      typeof input === "string" ? false : input.stopOnError ?? false;

    const result: Token<ErrorType, Kinds>[] = [];
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
        buffer: this._buffer,
        start: this._digested,
        rest: this.rest,
      });
      for (const def of this.defs) {
        // if def is never muted, ignore it
        if (!def.action.maybeMuted) {
          if (this.debug)
            this.logger(
              `[Lexer.trimStart] skip ${
                def.kind || "<anonymous>"
              } (never muted)`
            );
          continue;
        }

        const res = def.action.exec(input);
        if (res.accept) {
          if (!res.muted) {
            // next token is not muted
            // don't update state, just return
            if (this.debug)
              this.logger(
                `[Lexer.trimStart] not muted: ${
                  def.kind || "<anonymous>"
                }, stop trimming`
              );
            this.trimmed = true;
            return this;
          }

          // else, muted
          if (this.debug)
            this.logger(
              `[Lexer.trimStart] trim: ${
                def.kind || "<anonymous>"
              } content: ${JSON.stringify(res.content)}`
            );

          // next token is muted, update this state
          this.update(res.digested, res.content, res._rest);

          // construct token
          const token = this.res2token(res, def);

          // collect errors
          if (token.error) this.errors.push(token);

          // since muted, re-loop all definitions
          mute = true;
          break;
        } else {
          // not accept, try next def
          if (this.debug)
            this.logger(
              `[Lexer.trimStart] rejected: ${def.kind || "<anonymous>"}`
            );
        }
      }
      if (!mute) {
        // all definition checked, no accept
        if (this.debug) this.logger(`[Lexer.trimStart] no accept`);
        this.trimmed = true;
        return this;
      }
      // else, muted, re-loop all definitions
    }
  }

  getRest() {
    return this.rest ?? (this.rest = this._buffer.slice(this.digested));
  }

  hasRest() {
    return this.digested < this.buffer.length;
  }

  getTokenKinds() {
    const res: Set<Kinds> = new Set();
    this.defs.forEach((d) => res.add(d.kind));
    return res;
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

  hasErrors() {
    return this.errors.length != 0;
  }
}
