import {
  Definition,
  DefinitionContextBuilder,
  ParserBuilder,
} from "../builder";
import { GrammarExpander } from "./utils/advanced-grammar-parser";

export class AdvancedBuilder<T> {
  private readonly data: {
    defs: Definition;
    ctxBuilder?: DefinitionContextBuilder<T>;
  }[] = [];
  private readonly expander: GrammarExpander;

  constructor(options?: { prefix?: string }) {
    this.expander = new GrammarExpander({ placeholderPrefix: options?.prefix });
  }

  define(defs: Definition, ctxBuilder?: DefinitionContextBuilder<T>) {
    this.data.push({ defs, ctxBuilder });
    return this;
  }

  /** Expand this into a ParserBuilder. */
  expand(options?: { debug?: boolean }) {
    const builder = new ParserBuilder<T>({
      cascadeQueryPrefix: this.expander.placeholderPrefix,
    });
    this.data.forEach(({ defs, ctxBuilder }) => {
      for (const NT in defs) {
        const def = defs[NT];
        const defStr = def instanceof Array ? def.join("|") : def;
        const res = this.expander.parseAll(defStr);

        if (!res.accept || !this.expander.allParsed())
          throw new Error("Invalid grammar rule: " + defStr);

        const expanded = res.buffer[0].traverse()!;

        const resultDef: Definition = {};
        resultDef[NT] = expanded;
        if (options?.debug)
          console.log(`Expanded: ${NT}: \`${expanded.join(" | ")}\``);
        builder.define(resultDef, ctxBuilder);
      }
    });
    this.expander.generatePlaceholderGrammarRules().forEach((gr, NT) => {
      if (options?.debug) console.log(`Generated: ${NT}: \`${gr}\``);
      builder.define({ [NT]: gr });
    });
    return builder;
  }
}
