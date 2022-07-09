# CHANGELOG

## v0.2.0

- Optimize document / comments.
- Better export structure.
- Optimize code.
- Lexer
  - Decouple `Lexer` to `Lexer` and `Builder`.
  - Add `Lexer.hasError`.
- Parser
  - Rename `ParserManager` to `Manager` and put it in the top level.
  - Treat `Parser` as an interface instead of a type. Add `Parser.reset`.
  - `Manager` will only manage one parser instead of many.
  - `ASTNode` will record the start position.
  - `ASTNode.error` can be any type instead of string only.
- LR Parser
  - `ReducerContext.error` can be any type instead of string only.

## v0.1.1

Initial release.

Provide basic `Lexer`, `ParserManager` and `LRParser`.
