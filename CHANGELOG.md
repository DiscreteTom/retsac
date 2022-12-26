# CHANGELOG

## v0.4.0

- Lexer
  - Add optional `stopOnError` parameter to `Lexer.lexAll`.
  - Change `Token` and `Definition` from type to interface.
  - If token has no error, the error field will be `undefined`.
- Parser
  - If ASTNode has no error, the error field will be `undefined`.
  - Add `ASTNode.toObj` for serialization.
  - Add optional `stopOnError` parameter to `IParser.parse`.
  - LR Parser
    - If ReducerContext has no error, the error field will be `undefined`.
    - Change `ReducerContext` from type to interface.
    - Add optional `stopOnError` parameter to `DFA.parse` and `Parser.parse`.
    - Add `ParserBuilder.printConflicts` to detect shift-reduce & reduce-reduce conflicts.
- Optimize document / comments.
- Optimize code.
- More test code.

## v0.3.0

- Parser
  - Replace `ASTData` with generic type.
  - Remove `valueParser`.
  - LR Parser
    - Add `ParserBuilder.use` to re-use existing parser builder or modularize code.
    - `GrammarRule/Candidate.toString` will use `<=` as the default arrow instead of `=>`.
- Optimize document / comments.

## v0.2.0

- Better export structure.
- Lexer
  - Decouple `Lexer` to `Lexer` and `Builder`.
  - Add `Lexer.hasError`.
  - Fix `stringLiteral` to parse `\\` correctly.
  - More optional parameters for `stringLiteral` to support custom quotes.
  - Remove `Builder.overload`, but `Builder.define` can accept `ActionSource[]`.
- Parser
  - Rename `ParserManager` to `Manager` and put it in the top level.
  - Treat `Parser` as an interface `IParser` instead of a type. Add `IParser.reset`.
  - `ASTNode` will record the start position.
  - `ASTNode.error` can be any type instead of string only.
  - `ASTNode.toTreeString` has more format options.
  - Custom error class `ParserError`.
  - LR Parser
    - `ReducerContext.error` can be any type instead of string only.
    - Rename `LRParser` to `LR.Parser`, `LRParserBuilder` to `LR.ParserBuilder`.
- Manager
  - `Manager` will only manage one parser instead of many.
- Optimize document / comments.
- Optimize code.
- More examples.
- Test using jest.

## v0.1.1

Initial release.

Provide basic `Lexer`, `ParserManager` and `LRParser`.
