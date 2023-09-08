import { IParserBuilder } from "../../model/builder";

export function applyResolvers<ASTData, Kinds extends string>(
  builder: IParserBuilder<ASTData, "gr" | Kinds> // TODO: use &?
) {
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
    .leftSA({ gr: `gr '|' gr` }, { gr: `gr gr` }) as IParserBuilder<
    ASTData,
    Kinds
  >;
}
