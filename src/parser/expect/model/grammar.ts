import { GrammarRule } from "../../base";
import { ELRParserContext } from "./context";

export type ELRGrammarRule<T> = GrammarRule<T, string, ELRParserContext<T>>;
