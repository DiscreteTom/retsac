import { ELR } from "../../..";

export function applyResolvers<T>(builder: ELR.ParserBuilder<T>) {
  builder
    .resolveRS(
      { gr: `gr '|' gr` },
      { gr: `gr '?'` },
      { next: `'?'`, reduce: false }
    )
    .resolveRS(
      { gr: `gr '|' gr` },
      { gr: `gr '*'` },
      { next: `'*'`, reduce: false }
    )
    .resolveRS(
      { gr: `gr '|' gr` },
      { gr: `gr '+'` },
      { next: `'+'`, reduce: false }
    )
    .resolveRS(
      { gr: `gr '|' gr` },
      { gr: `gr '|' gr` },
      { next: `'|'`, reduce: true }
    )
    .resolveRS(
      { gr: `gr '|' gr` },
      { gr: `gr gr` },
      { next: `gr grammar literal '('`, reduce: false }
    )
    .resolveRS(
      { gr: `gr gr` },
      { gr: `gr '?'` },
      { next: `'?'`, reduce: false }
    )
    .resolveRS(
      { gr: `gr gr` },
      { gr: `gr '*'` },
      { next: `'*'`, reduce: false }
    )
    .resolveRS(
      { gr: `gr gr` },
      { gr: `gr '+'` },
      { next: `'+'`, reduce: false }
    )
    .resolveRS(
      { gr: `gr gr` },
      { gr: `gr '|' gr` },
      { next: `'|'`, reduce: true }
    )
    .resolveRS(
      { gr: `gr gr` },
      { gr: `gr gr` },
      { next: `gr grammar literal '('`, reduce: true }
    );
}
