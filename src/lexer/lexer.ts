import { defaultLogger, type Logger } from "../logger";
import type { ActionStateCloner } from "./action";
import type { LexerBuilderBuildOptions } from "./builder";
import { InvalidLengthForTakeError } from "./error";
import type { ILexerState } from "./model";
import type {
  Expectation,
  GeneralTokenDataBinding,
  ILexer,
  ILexerCloneOptions,
  IReadonlyLexer,
  IStatelessLexer,
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
> implements ILexer<DataBindings, ActionState, ErrorType>
{
  readonly stateless: IStatelessLexer<DataBindings, ActionState, ErrorType>;
  private _state: ILexerState<DataBindings, ErrorType>;
  actionState: ActionState;
  readonly defaultActionState: Readonly<ActionState>;
  readonly actionStateCloner: ActionStateCloner<ActionState>;
  debug: boolean;
  logger: Logger;

  constructor(
    stateless: IStatelessLexer<DataBindings, ActionState, ErrorType>,
    options: LexerBuilderBuildOptions & {
      buffer: string;
      defaultActionState: Readonly<ActionState>;
      actionStateCloner: ActionStateCloner<ActionState>;
    },
  ) {
    this.stateless = stateless;
    this._state = new LexerState(options.buffer);

    this.defaultActionState = options.defaultActionState;
    this.actionStateCloner = options.actionStateCloner;
    this.actionState = this.actionStateCloner(this.defaultActionState);

    this.debug = options.debug ?? false;
    this.logger = options.logger ?? defaultLogger;
  }

  get state() {
    return this._state.readonly;
  }

  get readonly() {
    return this as IReadonlyLexer<DataBindings, ActionState, ErrorType>;
  }

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
        buffer: this._state.buffer,
        ...options,
      },
    );
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
    res._state = this._state.clone();
    res.actionState = this.actionStateCloner(this.actionState);
    return res;
  }

  take(n = 1, actionState?: ActionState) {
    if (n > 0) {
      if (this.debug) {
        const content = this._state.buffer.slice(
          this._state.digested,
          this._state.digested + n,
        );
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

    this._state.digest(n, undefined);

    // update action state
    this.actionState =
      actionState ?? this.actionStateCloner(this.defaultActionState);

    return this;
  }

  peek(expectation?: Expectation<DataBindings["kind"]>) {
    const actionState = this.actionStateCloner(this.actionState);
    const output = this.stateless.lex(this._state.buffer, {
      start: this._state.digested,
      rest: this._state.rest.raw,
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

  lex(expectation?: Expectation<DataBindings["kind"]>) {
    const entity = "Lexer.lex";

    const res = this.stateless.lex(this._state.buffer, {
      start: this._state.digested,
      rest: this._state.rest.raw,
      expect: expectation,
      debug: this.debug,
      logger: this.logger,
      actionState: this.actionState,
      entity,
    });

    // update state
    this._state.digest(res.digested, res.rest);

    return res;
  }

  lexAll() {
    const result = {
      tokens: [] as Token<DataBindings, ErrorType>[],
      digested: 0,
      errors: [] as Token<DataBindings, ErrorType>[],
      rest: undefined as string | undefined,
    };
    while (true) {
      const res = this.lex();
      result.digested += res.digested;
      result.errors.push(...res.errors);
      result.rest = res.rest;

      if (res.token !== undefined) {
        result.tokens.push(res.token);
      } else return result;
    }
  }

  trim() {
    const entity = "Lexer.trimStart";

    if (this._state.trimmed)
      // already trimmed
      return {
        digested: 0,
        errors: [],
        rest: this._state.rest.raw,
      };

    const res = this.stateless.trim(this._state.buffer, {
      start: this._state.digested,
      rest: this._state.rest.raw,
      debug: this.debug,
      logger: this.logger,
      actionState: this.actionState,
      entity,
    });
    // update state
    this._state.trim(res.digested, res.rest);

    return res;
  }
}
