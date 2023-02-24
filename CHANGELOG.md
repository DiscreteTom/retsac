# CHANGELOG

## v0.6.0

- Parser
  - **Breaking Change**: `ASTNodeQuerySelector` a.k.a the `$` function will return a list of `ASTNode` instead of `ASTNode | undefined`, and can only query by type name not literals.
  - **Breaking Change**: Remove `GrammarRule.queryIndex`.
  - Add `ParserBuilder.cascadeQueryPrefix` to use cascade query in the `$` function.
  - Support `@` in grammar rules to rename a grammar when query using `$`.
  - Add `ELR.AdvancedBuilder` to build ELR parser, you can use `|+*()?` in your grammar rules.

## v0.5.1

- Optimize package size.

## v0.5.0

- Parser
  - Make `ASTNode.type/start/text/children` readonly.
  - Add `ASTNode.$` to query children by its type name or literal value.
  - Add `ASTNode.traverse` to traverse AST after parsing.
  - ELR Parser
    - Export `ELR.commit` and `ELR.rollback`.
    - **Breaking Change**: Reducer will take `ReducerContext` as the parameter instead of `ParserContext`.
    - **Breaking Change**: `ParserBuilder.checkSymbols/checkAll` will require a lexer to check if literals in grammar rules are valid.
- Optimize performance.

## v0.4.0

- Lexer
  - Add optional `stopOnError` parameter to `Lexer.lexAll`.
  - Change `Token` and `Definition` from type to interface.
  - If token has no error, the error field will be `undefined`.
  - Add interface `ILexer`.
  - Add `Lexer.clone/dryClone`.
  - `Lexer.lex` add optional parameter `expect` to limit the output token type or/and token content.
  - Add `Lexer.trimStart`.
  - Add `Lexer.take`.
  - Add `Lexer.digested`.
  - Rename `Lexer.hasError` to `Lexer.hasErrors`.
- Parser
  - If `ASTNode` has no error, the error field will be `undefined`.
  - Add `ASTNode.toObj` for serialization.
  - Add optional `stopOnError` parameter to `IParser.parse`.
  - `Parser.parse` will accept string as input instead of a list of ASTNode.
    - So each parser will have a lexer. Parser builders will need lexer when `build`.
  - **Remove LR parser**.
  - ELR Parser: Expectational LR Parser
    - Use `DefinitionContextBuilder` to define parser actions.
    - Rename `ReducerContext` to `ParserContext`.
    - If `ReducerContext` has no error, the error field will be `undefined`.
    - Add optional `stopOnError` parameter to `DFA.parse` and `Parser.parse`.
    - Add `ParserBuilder.checkConflicts` to ensure all reduce-shift and reduce-reduce conflicts are resolved.
      - It will also try to auto resolve conflicts by LR(1) peeking.
      - Add `ParserBuilder.resolveRS/resolveRR` to manually resolve conflicts.
      - Add `ParserBuilder.generateResolvers` to auto generate resolver template.
    - Add `ParserBuilder.checkAll` to do all necessary checks.
    - Replace `dataReducer` with `ELR.reducer`.
    - `GrammarRule/Candidate.toString` will output like user's definition using `:`, `` ` `` and `{}`.
    - DFA will cache state transition on the fly to optimize runtime performance.
      - Add `DFA.calculateAllStates` to calculate all state transitions ahead of time and cache them.
    - Remove `ParserBuilder.use`.
    - Add `ParserContext.$` to find AST node by its type name or literal value.
    - Parser will actively use Lexer to lex input string to token according to the grammar rules.
    - Re-Lex: If the lexed token can't be accepted, the parser will try to restore & re-lex input.
      - `Parser.commit` will abandon all other possibilities and only keep the current state.
      - `DefinitionContext` support `rollback` to rollback state when re-lex.
      - `DefinitionContext` support `commit` to prevent re-lex.
- Remove `Manager` since `Parser.parse` already accept string as input and keep a state.
- Optimize document / comments.
  - Generate documentation with [typedoc](https://typedoc.org/).
- Optimize code / performance.
- Use strict.
- More test code.
  - Enable code coverage report.

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
