import type { IParserBuilder } from "../../model";

export function applyResolvers<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
>(
  builder: IParserBuilder<
    ASTData,
    ErrorType,
    "gr" | Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >,
) {
  return builder.priority(
    [{ gr: `gr '?'` }, { gr: `gr '*'` }, { gr: `gr '+'` }],
    { gr: `gr gr` },
    { gr: `gr '|' gr` },
  );
}
