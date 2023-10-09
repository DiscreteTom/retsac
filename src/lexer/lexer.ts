import { defaultLogger, type Logger } from "../logger";
import type { AcceptedActionOutput } from "./action";
import { ActionInput } from "./action";
import type { LexerBuildOptions } from "./builder";
import { LexerCore } from "./core";
import { InvalidLengthForTakeError } from "./error";
import type { Definition, ILexer, Token } from "./model";
import { esc4regex } from "./utils";

/** Extract tokens from the input string. */
export class Lexer<ErrorType, Kinds extends string>
  implements ILexer<ErrorType, Kinds>
{
  debug: boolean;
  logger: Logger;
  readonly core: LexerCore<ErrorType, Kinds>;
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
  private _trimmed: boolean;
  /**
   * This is lazy and cached.
   * Only `update`, `reset` and `feed` can modify this var.
   */
  private rest?: string;

  constructor(
    defs: readonly Readonly<Definition<ErrorType, Kinds>>[],
    options?: LexerBuildOptions,
  ) {
    this.core = new LexerCore(defs); // TODO: use interface, don't create it here
    this.defs = defs;
    this.debug = options?.debug ?? false;
    this.logger = options?.logger ?? defaultLogger;
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

  get trimmed() {
    return this._trimmed;
  }

  reset() {
    if (this.debug) {
      this.logger.log({ entity: "Lexer.reset" });
    }
    this._buffer = "";
    this._digested = 0;
    this._lineChars = [0];
    this.errors.length = 0;
    this._trimmed = true; // no input yet, so no need to trim
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
    res._trimmed = this._trimmed;
    res.rest = this.rest;
    return res;
  }

  feed(input: string) {
    if (input.length == 0) return this;
    if (this.debug) {
      const info = { length: input.length };
      this.logger.log({
        entity: "Lexer.feed",
        message: `${info.length} chars`,
        info,
      });
    }
    this._buffer += input;
    this._trimmed = false; // maybe the new feed chars can construct a new token
    this.rest = undefined; // clear cache
    return this;
  }

  take(n = 1) {
    const content = this._buffer.slice(this._digested, this._digested + n);

    if (n > 0) {
      if (this.debug) {
        const info = { content };
        this.logger.log({
          entity: "Lexer.take",
          message: `${info.content.length} chars: ${JSON.stringify(
            info.content,
          )}`,
          info,
        });
      }
    } else throw new InvalidLengthForTakeError(n);

    this.update(n, content);
    return content;
  }

  takeUntil(
    pattern: string | RegExp,
    options?: {
      autoGlobal?: boolean;
    },
  ) {
    let regex =
      typeof pattern === "string" ? new RegExp(esc4regex(pattern)) : pattern;
    if ((options?.autoGlobal ?? true) && !regex.global && !regex.sticky)
      regex = new RegExp(regex.source, regex.flags + "g");

    regex.lastIndex = this._digested;
    const res = regex.exec(this._buffer);

    if (!res || res.index == -1) {
      if (this.debug) {
        const info = { regex };
        this.logger.log({
          entity: "Lexer.takeUntil",
          message: `no match: ${info.regex.toString()}`,
          info,
        });
      }
      return "";
    }

    const content = this._buffer.slice(this._digested, res.index + 1);
    if (this.debug) {
      const info = { regex, content };
      this.logger.log({
        entity: "Lexer.takeUntil",
        message: `${
          info.content.length
        } chars with ${info.regex.toString()}: ${JSON.stringify(info.content)}`,
        info,
      });
    }
    this.update(content.length, content);
    return content;
  }

  /** Update inner states. */
  private update(
    digested: number,
    content: string,
    // TODO: make this required?
    rest?: string,
  ) {
    this._digested += digested;
    this._trimmed = this._digested == this._buffer.length; // if all chars are digested, no need to trim
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
    def: Readonly<Definition<ErrorType, Kinds>>,
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
            kind?: Kinds;
            text?: string;
          }>;
          peek?: boolean;
        }> = "",
  ): Token<ErrorType, Kinds> | null {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input.input) this.feed(input.input);
    }

    const entity = "Lexer.lex";

    // calculate expect & peek
    const expect = {
      kind: typeof input === "string" ? undefined : input.expect?.kind,
      text: typeof input === "string" ? undefined : input.expect?.text,
    };
    const peek = typeof input === "string" ? false : input.peek ?? false;

    if (this.debug) {
      if (peek) {
        const info = { peek };
        this.logger.log({
          entity,
          message: `peek`,
          info,
        });
      }
    }

    const res = this.core.lex(this._buffer, {
      start: this._digested,
      rest: this.rest,
      expect,
      debug: this.debug,
      logger: this.logger,
    });

    // update state if not peek
    if (!peek) {
      this.update(
        res.digested,
        this._buffer.slice(this._digested, this._digested + res.digested),
        res.rest,
      );
      this.errors.push(...res.errors);
    }

    return res.token;
  }

  lexAll(
    input: string | { input?: string; stopOnError?: boolean } = "",
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
      if (this._trimmed) return this;

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
          if (this.debug) {
            const info = { kind: def.kind || "<anonymous>" };
            this.logger.log({
              entity: "Lexer.trimStart",
              message: `skip (never muted): ${info.kind}`,
              info,
            });
          }
          continue;
        }

        const res = def.action.exec(input);
        if (res.accept) {
          if (!res.muted) {
            // next token is not muted
            // don't update state, just return
            if (this.debug) {
              const info = {
                kind: def.kind || "<anonymous>",
                content: res.content,
              };
              this.logger.log({
                entity: "Lexer.trimStart",
                message: `found unmuted ${info.kind}: ${JSON.stringify(
                  info.content,
                )}`,
                info,
              });
            }
            this._trimmed = true;
            return this;
          }

          // else, muted
          if (this.debug) {
            const info = {
              kind: def.kind || "<anonymous>",
              content: res.content,
            };
            this.logger.log({
              entity: "Lexer.trimStart",
              message: `trim ${info.kind}: ${JSON.stringify(info.content)}`,
              info,
            });
          }

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
          if (this.debug) {
            const info = { kind: def.kind || "<anonymous>" };
            this.logger.log({
              entity: "Lexer.trimStart",
              message: `reject: ${info.kind}`,
              info,
            });
          }
        }
      }
      if (!mute) {
        // all definition checked, no accept
        if (this.debug) {
          this.logger.log({
            entity: "Lexer.trimStart",
            message: "no accept",
          });
        }
        this._trimmed = true;
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
