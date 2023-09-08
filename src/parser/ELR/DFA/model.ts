import { GrammarSet } from "../model";

/**
 * `NT => Grammars`
 */
export type FirstSets = Map<string, GrammarSet>;
export type ReadonlyFirstSets = ReadonlyMap<string, GrammarSet>;
/**
 * `grammar.kind => Grammars`
 */
export type FollowSets = Map<string, GrammarSet>;
export type ReadonlyFollowSets = ReadonlyMap<string, GrammarSet>;
