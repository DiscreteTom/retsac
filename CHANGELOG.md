# CHANGELOG

## v0.2.0

- Optimize document / comments.
- Better export structure.
- Optimize code.
- Lexer
  - Decouple `Lexer` to `Lexer` and `Builder`.
  - Add `Lexer.hasError`.
  - Fix `stringLiteral` to parse `\\` correctly.
  - More optional parameters for `stringLiteral` to support custom quotes.
  - Remove `Builder.overload`, but `Builder.define` can accept `ActionSource[]`.
- Parser
  - Rename `ParserManager` to `Manager` and put it in the top level.
  - Treat `Parser` as an interface `IParser` instead of a type. Add `IParser.reset`.
  - `Manager` will only manage one parser instead of many.
  - `ASTNode` will record the start position.
  - `ASTNode.error` can be any type instead of string only.
  - `ASTNode.toTreeString` has more format options.
  - Custom error class `ParserError`.
- LR Parser
  - `ReducerContext.error` can be any type instead of string only.
  - Rename `LRParser` to `LR.Parser`.

## v0.1.1

Initial release.

Provide basic `Lexer`, `ParserManager` and `LRParser`.
