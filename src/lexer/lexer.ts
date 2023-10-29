import { defaultLogger, type Logger } from "../logger";
import type { LexerBuildOptions } from "./builder";
import { InvalidLengthForTakeError } from "./error";
import type { ILexer, ILexerCore, Token, TokenDataBinding } from "./model";
import { LexerState } from "./state";
import { esc4regex } from "./utils";

/** Extract tokens from the input string. */
export class Lexer<
  Kinds extends string,
  Data,
  DataBindings extends TokenDataBinding<Kinds, Data>,
  ActionState,
  ErrorType,
> implements ILexer<Kinds, Data, DataBindings, ActionState, ErrorType>
{
  debug: boolean;
  logger: Logger;
  readonly core: ILexerCore<Kinds, Data, DataBindings, ActionState, ErrorType>;
  private state: LexerState<Kinds, Data, DataBindings, ErrorType>;

  constructor(
    core: ILexerCore<Kinds, Data, DataBindings, ActionState, ErrorType>,
    options?: LexerBuildOptions,
  ) {
    this.core = core;
    this.state = new LexerState(); // TODO: use interface?
    this.debug = options?.debug ?? false;
    this.logger = options?.logger ?? defaultLogger;
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

  get defs() {
    return this.core.defs;
  }

  reset() {
    if (this.debug) {
      this.logger.log({ entity: "Lexer.reset" });
    }
    this.core.reset();
    this.state.reset();
    return this;
  }

  dryClone(options?: { debug?: boolean; logger?: Logger }) {
    const res = new Lexer<Kinds, Data, DataBindings, ActionState, ErrorType>(
      this.core.dryClone(),
    );
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
    return res;
  }

  clone(options?: { debug?: boolean; logger?: Logger }) {
    const res = new Lexer<Kinds, Data, DataBindings, ActionState, ErrorType>(
      this.core.clone(),
    );
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
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
  ): Token<DataBindings, ErrorType> | null {
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

    const res = this.core.lex(this.buffer, {
      start: this.digested,
      rest: this.state.rest,
      expect,
      debug: this.debug,
      logger: this.logger,
      entity,
      peek,
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
  ): Token<DataBindings, ErrorType>[] {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input.input) this.feed(input.input);
    }

    const stopOnError =
      typeof input === "string" ? false : input.stopOnError ?? false;

    const result: Token<DataBindings, ErrorType>[] = [];
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

    const entity = "Lexer.trimStart";

    if (!this.trimmed) {
      const res = this.core.trimStart(this.buffer, {
        start: this.digested,
        rest: this.state.rest,
        debug: this.debug,
        logger: this.logger,
        entity,
      });
      // update state
      this.state.update(
        res.digested,
        this.buffer.slice(this.digested, this.digested + res.digested),
        res.rest,
      );
      this.errors.push(...res.errors);
      this.state.trimmed = true;
    }

    return this;
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
    this.core.defs.forEach((d) => d.kinds.forEach((k) => res.add(k)));
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
