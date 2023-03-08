import { ILexer } from "../../../lexer";
import { ParserBuilder } from "../builder";
import { BuildOptions, IParserBuilder } from "../model/builder";
import { GrammarExpander } from "./utils/advanced-grammar-parser";

export class AdvancedBuilder<T>
  extends ParserBuilder<T>
  implements IParserBuilder<T>
{
  private readonly expander: GrammarExpander;

  constructor(options?: { prefix?: string }) {
    const prefix = options?.prefix ?? `__`;
    super({ cascadeQueryPrefix: prefix });
    this.expander = new GrammarExpander({ placeholderPrefix: prefix });
  }

  build(lexer: ILexer, options?: BuildOptions) {
    // re-generate this.data
    const raw = this.data;
    this.data = [];
    raw.forEach(({ defs, ctxBuilder }) => {
      for (const NT in defs) {
        const def = defs[NT];
        const defStr = def instanceof Array ? def.join("|") : def;
        // expand raw's rule to this.data
        this.expander.expand(this, defStr, NT, ctxBuilder, options?.debug);
      }
    });
    this.expander.generatePlaceholderGrammarRules(this, options?.debug);

    return super.build(lexer, options);
  }
}
