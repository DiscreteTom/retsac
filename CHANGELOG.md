# CHANGELOG

## v0.16.1

- Parser
  - Fix: `structuredClone` not working in browser. See the details [here](https://stackoverflow.com/questions/77772877/).

## v0.16.0

- Lexer
  - Feat: add `ExtractToken`.
- Parser
  - Feat: `ASTNode`, `$` and `$$` are kind-sensitive.
  - **_Breaking Change_**: rewrite `ASTNode`, add `NTNode` and `TNode`.
    - Rewrite selectors and traversers.
  - **_Breaking Change_**: remove `IParserBuilder.lexer`. Set the lexer in parser builders' constructor instead.
  - **_Breaking Change_**: remove `ASTNode.token`, add `IParserBuilder.mapper` to transform token into `ASTData`. [#38](https://github.com/DiscreteTom/retsac/issues/38)
  - **_Breaking Change_**: `IParserBuilder.build` will consume the builder. Don't re-use the builder after calling `build`.
  - Feat: add `ExtractSerializableParserData`. [#41](https://github.com/DiscreteTom/retsac/issues/41)
  - Feat: add `ASTNode.global` to share data across all nodes.
    - Add `IParserBuilder.global` to set the global data and cloner.
  - Feat: allow multiple calls for `IParserBuilder.data`.
- Perf: prevent unnecessary calculation.
- Reduce package size. [#31](https://github.com/DiscreteTom/retsac/issues/31)
  - Optimize the format of serialized parser data, remove unused strings.

## v0.15.0

- Lexer
  - **_Breaking Change_**: remove `IReadonlyLexerCore.actions`, add `IReadonlyLexerCore.getTokenKinds`.
  - **_Breaking Change_**: remove `Builder.getTokenKinds`.
  - **_Breaking Change_**: remove `Lexer.fromTo`.
  - **_Breaking Change_**: rewrite `stringLiteral/numericLiteral/comment`.
    - Add `StringLiteralOptions/StringLiteralData/EscapeHandler`.
  - **_Breaking Change_**: rewrite `javascript.regexLiteral`.
  - **_Breaking Change_**: `Lexer.take/takeUntil` will reset lexer's action state by default. [#42](https://github.com/DiscreteTom/retsac/issues/42)
  - Feat: allow multiple calls for `Builder.state` and `Builder.error`.
  - Feat: add `ITrimmedLexer/IReadonlyTrimmedLexer`. [#37](https://github.com/DiscreteTom/retsac/issues/37)
  - Feat: `Builder.append` can accept actions with different data bindings in one call.
  - Feat: add `Lexer.javascript.evalStringContent/simpleStringLiteral/singleQuoteStringLiteral/doubleQuoteStringLiteral/templateStringLiteralLeft/templateStringLiteralRight`.
  - Feat: add `Lexer.integerLiteral/binaryIntegerLiteral/octalIntegerLiteral/hexIntegerLiteral` and `IntegerLiteralOptions/IntegerLiteralData`.
    - Add `Lexer.javascript.binaryIntegerLiteral/octalIntegerLiteral/hexIntegerLiteral/identifier`.
  - Feat: add `Lexer.json`.
  - Feat: add `Lexer.SubAction`, `Lexer.IntoSubAction`.
  - Feat: add `Lexer.Action.prevent`.
  - Feat: add `Lexer.invalidRejecter`.
  - Fix: `Lexer.trimStart` shouldn't collect non-muted errors.
- Parser
  - **_Breaking Change_**: lexer will be trimmed after every parse. This should improve the performance.
    - `GrammarRuleContext.lexer` will be `IReadonlyTrimmedLexer` instead of `IReadonlyLexer`.

## v0.14.0

- Lexer
  - **_Breaking Change_**: remove `Builder.select`, use `Builder.append` instead.
  - **_Breaking Change_**: rename `Action.map` to `Action.select`.
    - Feat: add `Action.map` to map data for multi kinds action. [#34](https://github.com/DiscreteTom/retsac/issues/34)
  - **_Breaking Change_**: rename `Action.clearData` to `Action.purge`.
  - Feat: `Builder.define` can accept actions with different data types in one call.
  - Fix: unclosed single line string literal should not include the tail `\n`. [#32](https://github.com/DiscreteTom/retsac/issues/32)
  - Fix: default `token.data` type should be `undefined` instead of `never`. [#33](https://github.com/DiscreteTom/retsac/issues/33)

## v0.13.1

- Fix: include utils.

## v0.13.0

- **_Breaking Change_**: re-order and simplify generic parameters.
- **_Breaking Change_**: remove `jsonLogger`, use `jsonLoggerFactory` instead.
- Lexer
  - **_Breaking Change_**: apply `LazyString` in `ActionInput/AcceptedActionOutput.rest`.
  - **_Breaking Change_**: customizable token data. [#29](https://github.com/DiscreteTom/retsac/issues/29)
    - Add `Action.data`.
  - **_Breaking Change_**: make `Action/Builder`'s default `ErrorType` to `never`.
  - **_Breaking Change_**: `Builder.define/ignore/anonymous` will accept functions as `ActionBuilder` instead of `SimpleActionExec`.
  - **_Breaking Change_**: make `Action`'s constructor private. Use `Action.exec` instead.
  - **_Breaking Change_**: utils will set token data when the value is invalid, instead of setting token error.
  - **_Breaking Change_**: all actions should have the same data type in one `Builder.define`.
  - **_Breaking Change_**: remove `ILexer.defs`, use `ILexer.core.defs` instead.
  - **_Breaking Change_**: rename `Builder.useState` to `Builder.state`.
  - Feat: add `ActionInput.peek`.
  - Feat: add `ActionBuilder` for chaining action decorators.
  - Feat: add `Builder.error` to set error type.
  - Feat: add `Builder.select` to allow an action to map multiple token kinds. [#28](https://github.com/DiscreteTom/retsac/issues/28)
    - Add `Action.kinds`, `ActionWithKinds` and `SelectedAction`.
  - Feat: add `Lexer.javascript`.
    - Add `evalString`. [#30](https://github.com/DiscreteTom/retsac/issues/30)
    - Add `comment`.
    - **_Breaking Change_**: move `regexLiteral/numericLiteral` into `Lexer.javascript`.
  - Feat: add option `lineContinuation` for `Lexer.stringLiteral`.
  - Feat: `Action.match` will set output data to `RegExpExecArray`.
    - Add `Action.dryMatch`.
  - Feat: add `ILexer/ILexerCore.readonly`.
- Parser
  - **_Breaking Change_**: add `ASTNode.token`.
  - **_Breaking Change_**: rename `IParserBuilder.useLexer/useData` to `IParserBuilder.lexer/data`.
    - **_Breaking Change_**: `IParserBuilder.lexer` must be called and only can be called once to set the lexer, instead of setting the lexer in `IParserBuilder.build`.
    - **_Breaking Change_**: `IParserBuilder.data` can only be called once.
    - **_Breaking Change_**: rewrite `BuilderDecorator` and `IParserBuilder.use`, restrict the modification only to the `Kinds`.
  - Feat: add `IParserBuilder.useData`.
- Optimize package size.

## v0.12.0

- **_Breaking Changes_**: rename `type` to `kind`.
- **_Breaking Change_**: rewrite `Logger`, add `defaultLogger` and `jsonLogger`. [#9](https://github.com/DiscreteTom/retsac/issues/9)
- Feat: add dist build. [#23](https://github.com/DiscreteTom/retsac/issues/23)
- Lexer
  - **_Breaking Change_**: `ActionExec` will take `ActionInput` as the input. [#6](https://github.com/DiscreteTom/retsac/issues/6)
    - Rename `ActionAcceptedOutput` to `AcceptedActionOutput`, and make it a class, rewrite its logics.
    - `Action.mute/check/reject/then` will take `AcceptedActionOutput` as the callback's param.
    - Regex should not starts with `^` and will auto have sticky flag.
  - **_Breaking Change_**: `Lexer.whitespaces` is now a function.
  - **_Breaking Change_**: add `ILexer.lineChars/errors`, remove `ILexer.getLineChars/getErrors`.
  - Feat: add `ILexer.defs/buffer`.
  - Feat: `SimpleActionExec` can accept `string/SimpleAcceptedActionOutput` as the output.
  - Feat: add generic parameter for Lexer family as the `Token.error` type.
  - Feat: add `options.autoSticky/autoGlobal` for `fromTo`.
  - Feat: export `Action.simple/match`. Add `options.autoSticky/rejectCaret` for `Action.match`.
  - Feat: add typed error.
  - Feat: add `ILexer.takeUntil`. [#16](https://github.com/DiscreteTom/retsac/issues/16)
  - Feat: add `Lexer.utils.regexLiteral`. [#15](https://github.com/DiscreteTom/retsac/issues/15)
  - Feat: add `ILexer.lex.peek`.
  - Feat: typed lexer. [#17](https://github.com/DiscreteTom/retsac/issues/17)
  - Feat: add `IReadonlyLexer`.
  - Feat: add utils `exactArray/wordArray/exactKind`.
  - Feat: add `IReadonlyLexer.trimmed`.
  - Feat: add `IReadonlyLexerCore/ILexerCore/LexerCore`.
  - Feat: add lexer's action state. [#25](https://github.com/DiscreteTom/retsac/issues/25)
  - Fix: actions won't be merged into one when calling `Builder.define/anonymous/ignore`. This will fix expectational lexing behaviour.
- Parser
  - Feat: add `name` for `ASTNode` and `ASTObj`.
    - **_Breaking Change_**: `ASTNode.toTreeString` will also print `ASTNode.name`.
    - **_Breaking Change_**: refactor `ASTNode.toString`. The output format is changed.
  - **_Breaking Change_**: rename `ASTNodeQuerySelector` to `ASTNodeChildrenSelector`.
  - **_Breaking Change_**: refactor typed errors.
  - **_Breaking Change_**: rename `ParserContext` to `GrammarRuleContext`, make `ParserContext` a class.
  - **_Breaking Change_**: remove `ReducerContext`, just use `GrammarRuleContext`.
  - **_Breaking Change_**: rename `BaseResolverOptions.reduce` to `accept`.
  - **_Breaking Change_**: rename `ASTNode.toObj` to `toJSON`.
  - **_Breaking Change_**: `ASTNode/GrammarRuleContext.$` is renamed to `ASTNode/GrammarRuleContext.$$` to search for an array.
    - Add `ASTNode/GrammarRuleContext.$` to search for the first match.
  - **_Breaking Change_**: remove `IParser.getErrors/getNodes`, use `IParser.errors/buffer` instead.
  - **_Breaking Change_**: `IParser.take` will auto commit the parser.
  - **_Breaking Change_**: `IParser.take` will take the first N nodes instead of the first one node.
  - **_Breaking Change_**: `IParserBuilder.build` with `checkAll` will also check if there is any rollback functions if rollback is disabled.
    - Add `checkRollback` for `IParserBuilder.build`.
  - **_Breaking Change_**: `IParserBuilder.entry` will check kinds.
  - **_Breaking Change_**: `IParserBuilder.build` will return `{ parser, serializable, mermaid }`.
  - **_Breaking Change_**: remove `IParserBuilder.leftSA/rightSA`, enhance the `IParserBuilder.priority` to support left-to-right or right-to-left associativity.
  - **_Breaking Change_**: entry NT's follow set will also be checked during parsing.
    - Add `BuildOptions/IParser.ignoreEntryFollow` to override the behaviour.
  - **_Breaking Change_**: use `builder.build({ lexer, entry })` instead of `builder.build(lexer)` and `builder.entry`.
  - **_Breaking Change_**: `GrammarRuleContext.lexer` is `ReadonlyILexer`.
  - **_Breaking Change_**: `IParserBuilder.build` with `generateResolvers` won't print resolvers. The resolver string is stored in the result of `IParserBuilder.build`.
  - **_Breaking Change_**: use array to define resolver's next set. E.g. ``{ next: [`'+'`], accept: true }``
  - **_Breaking Change_**: remove `IParser.clone/dryClone`.
  - **_Breaking Change_**: `IParserBuilder.define` now accept optional `DefinitionContextBuilderDecorator` to set the definition context.
  - Feat: typed parser.
    - Add `IParserBuilder.useLexer` to set lexer kinds and error types.
  - Feat: built-in support for conflict resolver. [#7](https://github.com/DiscreteTom/retsac/issues/7)
  - Feat: in `AdvancedBuilder` you can rename literals.
  - Feat: `children` in traverser is never `undefined`.
  - Feat: serialize parser. [#2](https://github.com/DiscreteTom/retsac/issues/2)
  - Feat: add `BuildOptions.mermaid` for parser to generate mermaid graph.
  - Feat: add `BuildOptions/IParser.autoCommit` for parser to auto commit when parsing.
  - Fix: fix follow set calculation. This will also reduce the number of unresolved conflicts.
  - Fix: fix `gr+` logic, treat the `gr` as a whole.
  - Fix: first defined resolver will be applied. Ignore others.
  - Fix: detect RS conflicts more accurately.
  - Note: optimize debug output.
- Optimize performance.
  - [#6](https://github.com/DiscreteTom/retsac/issues/6)
  - [#2](https://github.com/DiscreteTom/retsac/issues/2)
  - Lexer will skip unexpected actions by checking expected text.
  - Make unnecessary calculation lazy and cached.
  - Deduplicate possibilities when re-lex.
  - Remove unnecessary calculation when try lexing in `DFA.parse`.
  - Use serialized grammar parser in `AdvancedBuilder`. Thanks to [#2](https://github.com/DiscreteTom/retsac/issues/2).

## v0.11.0

Published by mistake :)

## v0.10.0

- Lexer
  - Feat: Add `debug/logger` option. #11
    - **_Breaking Change_**: Update `ILexer` model to adopt debug/logger options.
  - Feat: Add `Action.or` to cascade actions.
  - Feat: Add `Action.reduce` to reduce actions.
    - Perf: Apply this in `Lexer.Builder.define` to optimize performance.
  - Feat: `Lexer.Action.mute` can accept a function, `Lexer.Action.reject` can accept a boolean.
  - Feat: Add `Lexer.Action.error` to set error directly.
  - Feat: Add utils: `Lexer.whitespaces/comment/numericLiteral`. #5
  - Feat: Add utils `Lexer.esc4regex`.
  - Fix: Reset regex state for regex based actions.
  - **_Breaking Change_**: Remove `Lexer.from_to`, use `Lexer.fromTo` instead.
  - **_Breaking Change_**: New `Lexer.stringLiteral`, more options, more powerful.
- Parser
  - Feat: Literals in grammar rules also have name and can be renamed. #4
  - Feat: Add `logger` option. #11
    - **_Breaking Change_**: Update `IParser` model to adopt debug/logger options.
  - Feat: Optional re-lex and rollback by setting `ParserBuilder.options.reLex/rollback`.
    - **_Breaking Change_**: Disable rollback by default to optimize the performance.
  - **_Breaking Change_**: Export `IParserBuilder/BuilderDecorator` in the `ELR` namespace, instead of the top level.
  - **_Breaking Change_**: New `ASTNode.toTreeString`.

## v0.9.0

- Parser
  - Export `IParserBuilder/BuilderDecorator` in the top level.
  - **_Breaking Change_**: Change `LR_RuntimeError`, add `ParserTraverseError`.
  - **_Breaking Change_**: Remove `DFA.calculateAllStates` since all states will be calculated and cached when build DFA.
- Optimize performance.
  - Prevent unnecessary string copy.
  - Cache string manipulation results and other temp results.
  - Add `Lexer.Action.maybeMuted` to accelerate expectational lexing & `trimStart`.

## v0.8.0

- Parser
  - **_Breaking Change_**: `ParserBuilder.checkSymbols` is now private, use `options` in `ParserBuilder.build` instead.
  - **_Breaking Change_**: Remove `AdvancedBuilder.expand`, make `AdvancedBuilder` extend `ParserBuilder`, they both implement `IParserBuilder`.
  - Add `ParserBuilder.use` to apply custom decorators with chain call.
  - Add `IParserBuilder.priority/leftSA/rightSA` for simplified conflict resolution.
  - `AdvancedBuilder.resolveRS/resolveRR` support `+*?|()`.
  - Parser will calculate all DFA states at the start.
- Fix
  - Return `null` from `Traverser` will be transformed to `undefined`.
- Optimize performance.
  - Remove unnecessary conflict calculation.
  - Only handle conflicts that exactly exists in rejecter.
- Versioned documentation.

## v0.7.0

- Parser
  - Add `debug` option to `AdvancedBuilder.expand`.
  - Auto resolve R-S conflicts when `AdvancedBuilder.expand`.
  - Allow `'*'` as the `next` when resolve RS/RR conflicts.
  - **_Breaking Change_**: `ParserBuilder.generateResolvers/checkConflicts` is now private, and `ParserBuilder.checkAll` is removed. Use `options` in `ParserBuilder.build` instead.
- Fix
  - Parser can detect R-S conflict like: `` exp: `a b | a b c` `` where `b` is a terminator.
  - Parser won't print `[user resolved RR]` in debug mode when it's actually an R-S conflict.
- Optimize code & comments.
- Optimize performance.
  - Merge `ParserBuilder.generateResolvers/checkConflicts` to `ParserBuilder.build` to avoid unnecessary DFA build.
  - Re-use computed conflicts when generate resolvers and check conflicts.
  - Pre-calculate values before the parser is built to avoid repeated calculation.
  - Reduce the use of `TempGrammar/TempGrammarRule`, use `Grammar/GrammarRule` instead.
- More tests.

## v0.6.0

- Parser
  - **_Breaking Change_**: `ASTNodeQuerySelector` a.k.a the `$` function will return a list of `ASTNode` instead of `ASTNode | undefined`, and can only query by type name not literals.
  - **_Breaking Change_**: Remove `GrammarRule.queryIndex`.
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
    - **_Breaking Change_**: Reducer will take `ReducerContext` as the parameter instead of `ParserContext`.
    - **_Breaking Change_**: `ParserBuilder.checkSymbols/checkAll` will require a lexer to check if literals in grammar rules are valid.
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
