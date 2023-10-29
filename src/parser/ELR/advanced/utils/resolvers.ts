import type { GeneralTokenDataBinding } from "../../../../lexer";
import type { IParserBuilder } from "../../model";

export function applyResolvers<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerError,
  LexerActionState,
>(
  builder: IParserBuilder<
    ASTData,
    ErrorType,
    "gr" | Kinds,
    LexerDataBindings,
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
