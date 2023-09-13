import type { GrammarSet } from "../model";

/**
 * `NT => Grammars`
 */
export type FirstSets = Map<string, GrammarSet>;
/**
 * `NT => Grammars`
 */
export type ReadonlyFirstSets = ReadonlyMap<string, GrammarSet>;
/**
 * `grammar.kind => Grammars`
 */
export type FollowSets = Map<string, GrammarSet>;
/**
 * `grammar.kind => Grammars`
 */
export type ReadonlyFollowSets = ReadonlyMap<string, GrammarSet>;
