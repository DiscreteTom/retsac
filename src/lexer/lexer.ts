import { defaultLogger, type Logger } from "../logger";
import type { ActionStateCloner } from "./action";
import type { LexerBuilderBuildOptions } from "./builder";
import type { StatelessLexer } from "./stateless";
import { InvalidLengthForTakeError } from "./error";
import type {
  GeneralTokenDataBinding,
  ILexerCloneOptions,
  ILexerCoreLexOptions,
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
  readonly stateless: StatelessLexer<DataBindings, ActionState, ErrorType>;
  private state: LexerState<DataBindings, ErrorType>;
  actionState: ActionState;
  readonly defaultActionState: Readonly<ActionState>;
  readonly actionStateCloner: ActionStateCloner<ActionState>;
  debug: boolean;
  logger: Logger;

  constructor(
    stateless: StatelessLexer<DataBindings, ActionState, ErrorType>,
    options: LexerBuilderBuildOptions & {
      buffer: string;
      defaultActionState: Readonly<ActionState>;
      actionStateCloner: ActionStateCloner<ActionState>;
    },
  ) {
    this.stateless = stateless;
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
    const res = new Lexer<DataBindings, ActionState, ErrorType>(
      this.stateless,
      {
        defaultActionState: this.defaultActionState,
        actionStateCloner: this.actionStateCloner,
        buffer,
        ...options,
      },
    );
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
    return res;
  }

  clone(options?: ILexerCloneOptions) {
    const res = new Lexer<DataBindings, ActionState, ErrorType>(
      this.stateless,
      {
        defaultActionState: this.defaultActionState,
        actionStateCloner: this.actionStateCloner,
        buffer: this.state.buffer,
        ...options,
      },
    );
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

    this.state.digest(n, undefined);

    // update action state
    if (state === undefined)
      this.actionState = this.actionStateCloner(this.defaultActionState);
    else this.actionState = state;

    return content;
  }

  peek(
    expectation?: ILexerCoreLexOptions<DataBindings, ActionState>["expect"],
  ) {
    const actionState = this.actionStateCloner(this.actionState);
    const output = this.stateless.lex(this.state.buffer, {
      start: this.state.digested,
      rest: this.state.rest,
      expect: expectation,
      debug: this.debug,
      logger: this.logger,
      actionState,
      entity: "Lexer.peek",
    });
    return {
      ...output,
      actionState,
    };
  }

  lex(
    expectation?: ILexerCoreLexOptions<DataBindings, ActionState>["expect"],
  ): Token<DataBindings, ErrorType> | null {
    const entity = "Lexer.lex";

    const res = this.stateless.lex(this.state.buffer, {
      start: this.state.digested,
      rest: this.state.rest,
      expect: expectation,
      debug: this.debug,
      logger: this.logger,
      actionState: this.actionState,
      entity,
    });

    // update state
    this.state.digest(res.digested, res.rest);

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

  trim() {
    const entity = "Lexer.trimStart";

    if (!this.state.trimmed) {
      const res = this.stateless.trim(this.state.buffer, {
        start: this.state.digested,
        rest: this.state.rest,
        debug: this.debug,
        logger: this.logger,
        actionState: this.actionState,
        entity,
      });
      // update state
      this.state.trim(res.digested, res.rest);
    }

    // TODO: fix type
    return this as unknown as ITrimmedLexer<
      DataBindings,
      ActionState,
      ErrorType
    >;
  }
}
