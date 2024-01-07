import type { GeneralTokenDataBinding } from "../../../../lexer";
import type { IParserBuilder } from "../../model";

export function applyResolvers<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  builder: IParserBuilder<
    "gr" | NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
) {
  return builder.priority(
    [{ gr: `gr '?'` }, { gr: `gr '*'` }, { gr: `gr '+'` }],
    { gr: `gr gr` },
    { gr: `gr '|' gr` },
  );
}
