import type { IParserBuilder } from "../../model";

export function applyResolvers<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
>(builder: IParserBuilder<ASTData, ErrorType, "gr" | Kinds, LexerKinds>) {
  return builder
    .priority(
      [{ gr: `gr '?'` }, { gr: `gr '*'` }, { gr: `gr '+'` }],
      { gr: `gr gr` },
      { gr: `gr '|' gr` }
    )
    .priority(
      { gr: `grammar rename | literal rename` },
      { gr: `grammar | literal` }
    )
    .leftSA({ gr: `gr '|' gr` }, { gr: `gr gr` });
}
