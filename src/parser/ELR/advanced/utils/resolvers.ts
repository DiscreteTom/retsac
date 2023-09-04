import { IParserBuilder } from "../../model/builder";

export function applyResolvers<T, Kinds extends string>(
  builder: IParserBuilder<T, "gr" | Kinds> // TODO: use &?
) {
  return builder
    .priority(
      [{ gr: `gr '?'` }, { gr: `gr '*'` }, { gr: `gr '+'` }],
      { gr: `gr gr` },
      { gr: `gr '|' gr` }
    )
    .leftSA({ gr: `gr '|' gr` }, { gr: `gr gr` }) as IParserBuilder<T, Kinds>;
}
