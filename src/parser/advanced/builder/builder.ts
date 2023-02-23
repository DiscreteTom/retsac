import { Definition, DefinitionContextBuilder, ParserBuilder } from "../../ELR";
import {
  generatePlaceholderGrammarRules,
  parser,
  setPrefix,
} from "./utils/advanced-grammar-parser";

export class AdvancedBuilder<T> {
  private readonly data: {
    defs: Definition;
    ctxBuilder?: DefinitionContextBuilder<T>;
  }[] = [];

  constructor(options?: { prefix?: string }) {
    if (options?.prefix) setPrefix(options?.prefix);
  }

  define(defs: Definition, ctxBuilder?: DefinitionContextBuilder<T>) {
    this.data.push({ defs, ctxBuilder });
    return this;
  }

  /** Expand this into a ParserBuilder. */
  expand() {
    const builder = new ParserBuilder<T>();
    this.data.forEach(({ defs, ctxBuilder }) => {
      for (const NT in defs) {
        const def = defs[NT];
        const defStr = def instanceof Array ? def.join("|") : def;
        const res = parser.reset().parseAll(defStr);

        if (!res.accept || parser.lexer.hasRest() || res.buffer.length != 1)
          throw new Error("Invalid grammar rule: " + defStr);

        const expanded = res.buffer[0].traverse()!;

        const resultDef: Definition = {};
        resultDef[NT] = expanded;
        builder.define(resultDef, ctxBuilder);
      }
    });
    generatePlaceholderGrammarRules().forEach((gr, NT) =>
      builder.define({ [NT]: gr })
    );
    return builder;
  }
}
