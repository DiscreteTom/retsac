import type {
  GeneralTokenDataBinding,
  IReadonlyLexer,
} from "../../../../lexer";
import type { DFA } from "../../DFA";
import type { SerializableParserData } from "../../model";
import { hashStringToNum } from "../../utils";
import type { ParserBuilderData } from "../model";

export function calculateHash<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
>(
  data: readonly Readonly<
    ParserBuilderData<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >
  >[],
  entryNTs: ReadonlySet<Kinds>,
  lexer: IReadonlyLexer<LexerDataBindings, LexerActionState, LexerErrorType>,
  cascadeQueryPrefix: string | undefined,
) {
  return hashStringToNum(
    JSON.stringify({
      // ensure lexer kinds are not changed
      lexerKinds: [...lexer.getTokenKinds()],
      // ensure grammar rules & resolvers are not changed
      data: data.map((d) => ({
        defs: d.defs,
        ctxBuilder: d.ctxBuilder?.build(),
        resolveOnly: d.resolveOnly,
        hydrationId: d.hydrationId,
      })),
      // ensure the cascade query prefix is not changed
      cascadeQueryPrefix: cascadeQueryPrefix,
      // ensure entry NTs are not changed
      entryNTs: [...entryNTs],
    }),
  );
}

export function buildSerializable<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
>(
  data: readonly Readonly<
    ParserBuilderData<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >
  >[],
  dfa: DFA<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >,
  entryNTs: ReadonlySet<Kinds>,
  lexer: IReadonlyLexer<LexerDataBindings, LexerActionState, LexerErrorType>,
  cascadeQueryPrefix: string | undefined,
): SerializableParserData<Kinds, LexerDataBindings> {
  return {
    hash: calculateHash(data, entryNTs, lexer, cascadeQueryPrefix),
    data: { dfa: dfa.toJSON() },
  };
}
