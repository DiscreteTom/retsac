import { defaultLogger, type Logger } from "../logger";
import type { AcceptedActionOutput } from "./action";
import { ActionInput } from "./action";
import type { LexerBuildOptions } from "./builder";
import { InvalidLengthForTakeError } from "./error";
import type { Definition, ILexer, Token } from "./model";
import { LexerState } from "./state";
import { StatelessLexer } from "./stateless";
import { esc4regex } from "./utils";

/** Extract tokens from the input string. */
export class Lexer<ErrorType, Kinds extends string>
  implements ILexer<ErrorType, Kinds>
{
  debug: boolean;
  logger: Logger;
  readonly defs: readonly Readonly<Definition<ErrorType, Kinds>>[];
  readonly stateless: StatelessLexer<ErrorType, Kinds>;
  private state: LexerState<ErrorType, Kinds>;

  constructor(
    defs: readonly Readonly<Definition<ErrorType, Kinds>>[],
    options?: LexerBuildOptions,
  ) {
    this.stateless = new StatelessLexer(defs); // TODO: use interface, don't create it here
    this.state = new LexerState();
    this.defs = defs;
    this.debug = options?.debug ?? false;
    this.logger = options?.logger ?? defaultLogger;
    this.reset();
  }

  get buffer() {
    return this.state.buffer;
  }

  get digested() {
    return this.state.digested;
  }

  get lineChars(): readonly number[] {
    return this.state.lineChars;
  }

  get trimmed() {
    return this.state.trimmed;
  }

  get errors() {
    return this.state.errors;
  }

  reset() {
    if (this.debug) {
      this.logger.log({ entity: "Lexer.reset" });
    }
    this.state.reset();
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
    res.state = this.state.clone();
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
    this.state.feed(input);
    return this;
  }

  take(n = 1) {
    const content = this.buffer.slice(this.digested, this.digested + n);

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

    this.state.update(n, content, undefined);
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

    regex.lastIndex = this.digested;
    const res = regex.exec(this.buffer);

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

    const content = this.buffer.slice(this.digested, res.index + 1);
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
    this.state.update(content.length, content, undefined);
    return content;
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

    const res = this.stateless.lex(this.buffer, {
      start: this.digested,
      rest: this.state.rest,
      expect,
      debug: this.debug,
      logger: this.logger,
      entity,
    });

    // update state if not peek
    if (!peek) {
      this.state.update(
        res.digested,
        this.buffer.slice(this.digested, this.digested + res.digested),
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
      // when no rest, this.trimmed is set to true by this.state.update
      if (this.trimmed) return this;

      let mute = false;
      // all defs will reuse this input to reuse lazy values
      const input = new ActionInput({
        buffer: this.buffer,
        start: this.digested,
        rest: this.state.rest,
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
            this.state.trimmed = true;
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
          this.state.update(res.digested, res.content, res._rest);

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
        this.state.trimmed = true;
        return this;
      }
      // else, muted, re-loop all definitions
    }
  }

  getRest() {
    return (
      this.state.rest ?? (this.state.rest = this.buffer.slice(this.digested))
    );
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
