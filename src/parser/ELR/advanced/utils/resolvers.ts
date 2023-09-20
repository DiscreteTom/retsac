import type { IParserBuilder } from "../../model";

export function applyResolvers<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  builder: IParserBuilder<
    ASTData,
    ErrorType,
    "gr" | Kinds,
    LexerKinds,
    LexerError
  >,
) {
  return builder.priority(
    [{ gr: `gr '?'` }, { gr: `gr '*'` }, { gr: `gr '+'` }],
    { gr: `gr gr` },
    { gr: `gr '|' gr` },
  );
}
