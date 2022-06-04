import { ASTData, ASTNode } from "../ast";

export type ReducerContext = {
  data: ASTData;
  readonly matched: ASTNode[];
  readonly before: ASTNode[];
  readonly after: ASTNode[];
  error: string;
};

export type Grammar =
  | {
      type: "literal";
      content: string; // without quotes
    }
  | {
      type: "grammar";
      name: string; // T's or NT's name
    };

export type GrammarCallback = (context: ReducerContext) => void;

export type Rejecter = (context: ReducerContext) => boolean; // return true if conflict

export type GrammarRule = {
  rule: Grammar[]; // a list of Ts or NTs or literal strings
  NT: string; // the reduce target
  callback: GrammarCallback;
  rejecter: Rejecter;
};
