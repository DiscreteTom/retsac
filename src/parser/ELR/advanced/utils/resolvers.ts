import type { GeneralTokenDataBinding } from "../../../../lexer";
import type { IParserBuilder } from "../../model";

export function applyResolvers<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
>(
  builder: IParserBuilder<
    "gr" | Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >,
) {
  return builder.priority(
    [{ gr: `gr '?'` }, { gr: `gr '*'` }, { gr: `gr '+'` }],
    { gr: `gr gr` },
    { gr: `gr '|' gr` },
  );
}
