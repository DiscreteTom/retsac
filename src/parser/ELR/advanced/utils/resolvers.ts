import { IParserBuilder } from "../../model/builder";

export function applyResolvers<T>(builder: IParserBuilder<T>) {
  return builder
    .priority(
      [{ gr: `gr '?'` }, { gr: `gr '*'` }, { gr: `gr '+'` }],
      { gr: `gr gr` },
      { gr: `gr '|' gr` }
    )
    .leftSA({ gr: `gr '|' gr` }, { gr: `gr gr` });
}
