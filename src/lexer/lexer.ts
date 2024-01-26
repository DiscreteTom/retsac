import { defaultLogger, type Logger } from "../logger";
import type { ActionStateCloner } from "./action";
import type { LexerBuilderBuildOptions } from "./builder";
import type { LexerCore } from "./core";
import { InvalidLengthForTakeError } from "./error";
import type {
  GeneralTokenDataBinding,
  ILexerCloneOptions,
  ILexerLexOptions,
  ITrimmedLexer,
  Token,
} from "./model";
import { LexerState } from "./state";

/**
 * Extract tokens from the input string.
 */
export class Lexer<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> {
  debug: boolean;
  logger: Logger;
  readonly core: LexerCore<DataBindings, ActionState, ErrorType>;
  state: LexerState<DataBindings, ErrorType>;
  actionState: ActionState;
  readonly defaultActionState: Readonly<ActionState>;
  readonly actionStateCloner: ActionStateCloner<ActionState>;

  constructor(
    core: LexerCore<DataBindings, ActionState, ErrorType>,
    options: LexerBuilderBuildOptions & {
      buffer: string;
      defaultActionState: Readonly<ActionState>;
      actionStateCloner: ActionStateCloner<ActionState>;
    },
  ) {
    this.core = core;
    this.state = new LexerState(options.buffer);

    this.defaultActionState = options.defaultActionState;
    this.actionStateCloner = options.actionStateCloner;
    this.actionState = this.actionStateCloner(this.defaultActionState);

    this.debug = options.debug ?? false;
    this.logger = options.logger ?? defaultLogger;
  }

  // TODO
  // get readonly() {
  //   return this as IReadonlyLexer<DataBindings, ActionState, ErrorType>;
  // }

  dryClone(buffer: string, options?: ILexerCloneOptions) {
    const res = new Lexer<DataBindings, ActionState, ErrorType>(this.core, {
      defaultActionState: this.defaultActionState,
      actionStateCloner: this.actionStateCloner,
      buffer,
      ...options,
    });
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
    return res;
  }

  clone(options?: ILexerCloneOptions) {
    const res = new Lexer<DataBindings, ActionState, ErrorType>(this.core, {
      defaultActionState: this.defaultActionState,
      actionStateCloner: this.actionStateCloner,
      buffer: this.state.buffer,
      ...options,
    });
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
    res.state = this.state.clone();
    res.actionState = this.actionStateCloner(this.actionState);
    return res;
  }

  take(n = 1, state?: ActionState) {
    const content = this.state.buffer.slice(
      this.state.digested,
      this.state.digested + n,
    );

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

    this.state.take(n, undefined);

    // update action state
    if (state === undefined)
      this.actionState = this.actionStateCloner(this.defaultActionState);
    else this.actionState = state;

    return content;
  }

  lex(
    input: string | Readonly<ILexerLexOptions<DataBindings>> = "",
  ): Token<DataBindings, ErrorType> | null {
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

    const res = this.core.lex(this.state.buffer, {
      start: this.state.digested,
      rest: this.state.rest,
      expect,
      debug: this.debug,
      logger: this.logger,
      actionState: this.actionState,
      entity,
      peek,
    });

    // update state if not peek
    if (!peek) {
      this.state.take(res.digested, res.rest);
      // action state will be updated in core automatically if peek is false
    }

    return res.token;
  }

  lexAll(): Token<DataBindings, ErrorType>[] {
    const result: Token<DataBindings, ErrorType>[] = [];
    while (true) {
      const res = this.lex();
      if (res !== null) {
        result.push(res);
      } else break;
    }
    return result;
  }

  // TODO: rename
  trimStart() {
    const entity = "Lexer.trimStart";

    if (!this.state.trimmed) {
      const res = this.core.trimStart(this.state.buffer, {
        start: this.state.digested,
        rest: this.state.rest,
        debug: this.debug,
        logger: this.logger,
        actionState: this.actionState,
        entity,
      });
      // update state
      this.state.take(res.digested, res.rest);
      this.state.setTrimmed();
    }

    // TODO: fix type
    return this as unknown as ITrimmedLexer<
      DataBindings,
      ActionState,
      ErrorType
    >;
  }

  getRest() {
    return this.state.getRest();
  }

  hasRest() {
    return this.state.digested < this.state.buffer.length;
  }

  getTokenKinds() {
    return this.core.getTokenKinds();
  }
}
