import type { IReadonlyLexer } from "../../../../lexer";
import type { DFA } from "../../DFA";
import type { SerializableParserData } from "../../model";
import { hashStringToNum } from "../../utils";
import type { ParserBuilderData } from "../model";

export function calculateHash<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
  AppendLexerKinds extends string,
  AppendLexerError,
  AppendLexerActionState,
>(
  data: readonly Readonly<
    ParserBuilderData<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >
  >[],
  entryNTs: ReadonlySet<Kinds>,
  lexer: IReadonlyLexer<
    LexerError | AppendLexerError,
    LexerKinds | AppendLexerKinds,
    LexerActionState | AppendLexerActionState
  >,
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
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
  AppendLexerKinds extends string,
  AppendLexerError,
  AppendLexerActionState,
>(
  data: readonly Readonly<
    ParserBuilderData<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError,
      LexerActionState
    >
  >[],
  dfa: DFA<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds | AppendLexerKinds,
    LexerError | AppendLexerError,
    LexerActionState | AppendLexerActionState
  >,
  entryNTs: ReadonlySet<Kinds>,
  lexer: IReadonlyLexer<
    LexerError | AppendLexerError,
    LexerKinds | AppendLexerKinds,
    LexerActionState | AppendLexerActionState
  >,
  cascadeQueryPrefix: string | undefined,
): SerializableParserData<Kinds, LexerKinds | AppendLexerKinds> {
  return {
    hash: calculateHash(data, entryNTs, lexer, cascadeQueryPrefix),
    data: { dfa: dfa.toJSON() },
  };
}
