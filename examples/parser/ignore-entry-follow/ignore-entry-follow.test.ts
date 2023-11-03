import { Lexer, ELR } from "../../../src";
import { StateCacheMissError } from "../../../src/parser/ELR";

test("calculator", () => {
  // for most cases, we want the input string to be reduced into one single root ASTNode
  // for example, below is a simplified calculator grammar, and the entry is `exp`
  const { parser } = new ELR.AdvancedBuilder()
    .lexer(
      new Lexer.Builder()
        .ignore(Lexer.whitespaces())
        .define({ number: Lexer.javascript.numericLiteral() })
        .anonymous(Lexer.exact(..."+-"))
        .build(),
    )
    .define({ exp: "number" })
    .define({ exp: `exp '+' exp` })
    .priority({ exp: `exp '+' exp` }) // make it left associative
    .build({
      entry: "exp",
    });

  // when we use `parse` to parse the input, it will stop when it get the first entry NT
  // so when we parse `1+1`, the parser transform the first `1` into a `number` then into an `exp`
  // and stopped here, so the `+1` won't be parsed
  let res = parser.reset().parse("1+1");
  expect(res.accept).toBe(true);
  expect(parser.lexer.getRest()).toBe("+1");
  expect(parser.buffer[0].kind).toBe("exp");
  expect(parser.buffer[0].children![0].kind).toBe("number");
  expect(parser.buffer[0].children![0].text).toBe("1");

  // if we want to parse the whole input, we can use `parseAll`
  // it will try to parse until the parser can't accept more input
  // and since the entry NT `exp` is also a part of some grammar rules
  // the parser can continue the reducing process
  res = parser.reset().parseAll("1+1");
  expect(res.accept).toBe(true);
  expect(parser.lexer.getRest()).toBe("");
  expect(parser.buffer[0].kind).toBe("exp");
  expect(parser.buffer[0].children?.length).toBe(3);
  expect(parser.buffer[0].children![0].kind).toBe("exp");
  expect(parser.buffer[0].children![0].children![0].kind).toBe("number");
  expect(parser.buffer[0].children![0].children![0].text).toBe("1");
  expect(parser.buffer[0].children![1].text).toBe("+");
  expect(parser.buffer[0].children![2].kind).toBe("exp");
  expect(parser.buffer[0].children![2].children![0].kind).toBe("number");
  expect(parser.buffer[0].children![2].children![0].text).toBe("1");
});

test("programming language", () => {
  // however, when writing a programming language parser
  // a source code file often contains multiple top-level statements
  // for example, function definition statements.
  // here is a simplified grammar for function definition statements
  const { parser } = new ELR.AdvancedBuilder()
    .lexer(
      new Lexer.Builder()
        .ignore(Lexer.whitespaces())
        .define(Lexer.wordKind("fn"))
        .define({ identifier: /\w+/ })
        .anonymous(Lexer.exact(..."();"))
        .build(),
    )
    .define({ fn_def_stmt: `fn identifier '(' ')' ';'` })
    .build({
      entry: "fn_def_stmt",
    });

  // the parser is working with single top-level statements
  let res = parser.reset().parse("fn foo();");
  expect(res.accept).toBe(true);
  expect(parser.lexer.getRest()).toBe("");

  // however, the parser can't accept input with multi top-level statements.
  // not a single top-level statement is accepted
  res = parser.reset().parse("fn foo(); fn bar();");
  expect(res.accept).toBe(false);
  expect(parser.lexer.getRest()).toBe("fn foo(); fn bar();");
  // the reason of this behaviour is that, the follow set of `fn_def_stmt` is empty
  // since `fn_def_stmt` is an entry NT, nothing should follow it
  // so when we are trying to accept `fn foo();`, the parser peek the next token `fn`
  // and found that `fn` is not in the follow set of `fn_def_stmt`, then it rejects to accept

  // calling `parseAll` won't help, either
  // because the `parseAll` will call `parse` internally to try to parse the input
  res = parser.reset().parseAll("fn foo(); fn bar();");
  expect(res.accept).toBe(false);
  expect(parser.lexer.getRest()).toBe("fn foo(); fn bar();");

  // a work around is to define a new entry, which accept multiple top-level statements
  const { parser: newParser } = new ELR.AdvancedBuilder()
    .lexer(
      new Lexer.Builder()
        .ignore(Lexer.whitespaces())
        .define(Lexer.wordKind("fn"))
        .define({ identifier: /\w+/ })
        .anonymous(Lexer.exact(..."();"))
        .build(),
    )
    .define({ fn_def_stmt: `fn identifier '(' ')' ';'` })
    // `+` means one or more
    // don't use `*` since we don't allow empty grammar rule
    .define({ entry: `fn_def_stmt+` })
    .build({
      entry: "entry", // use the new entry
    });

  // now we can use `parseAll` to parse the input
  let newRes = newParser.reset().parseAll("fn foo(); fn bar();");
  expect(newRes.accept).toBe(true);
  expect(newParser.lexer.getRest()).toBe("");

  // since the `+` is greedy, we can also use `parse`.
  // when we are trying to accept `fn foo();` as the entry
  // the generated conflict resolver will make the parser to accept more input
  // until we digest all the input
  newRes = newParser.reset().parse("fn foo(); fn bar();");
  expect(newRes.accept).toBe(true);
  expect(newParser.lexer.getRest()).toBe("");
});

test("with ignoreEntryFollow", () => {
  // the new-entry solution is not elegant
  // first, we have to define a new entry grammar rule
  // second, we can only get the output when the whole file is parsed
  // but when writing a programming language parser
  // we may want to get the output once a top-level statement is parsed

  // introducing `ignoreEntryFollow`
  const { parser } = new ELR.AdvancedBuilder()
    .lexer(
      new Lexer.Builder()
        .ignore(Lexer.whitespaces())
        .define(Lexer.wordKind("fn"))
        .define({ identifier: /\w+/ })
        .anonymous(Lexer.exact(..."();"))
        .build(),
    )
    .define({ fn_def_stmt: `fn identifier '(' ')' ';'` })
    .build({
      entry: "fn_def_stmt",
      ignoreEntryFollow: true, // set this to `true`
    });

  // the `ignoreEntryFollow` will make the parser to accept the entry NT immediately
  // without checking the follow set of the entry NT

  // now we can use `parse` to get the first top-level statement
  let res = parser.reset().parse("fn foo(); fn bar();");
  expect(res.accept).toBe(true);
  expect(parser.lexer.getRest()).toBe(" fn bar();");
  // and take it out from the parser buffer
  parser.take(1);
  // then parse the second top-level statement
  res = parser.parse();
  expect(res.accept).toBe(true);
  expect(parser.lexer.getRest()).toBe("");

  // since we need to take out the parsed ASTNode from the parser buffer after the first parse
  // we can't use `parseAll` to do this automatically
  // the parser will throw error because no grammar rule has `fn_def_stmt` as the first grammar
  expect(() => parser.reset().parseAll("fn foo(); fn bar();")).toThrow(
    StateCacheMissError,
  );
});

test("abuse", () => {
  // however, `ignoreEntryFollow` is not a silver bullet
  // abuse it will cause partial accepted input or unexpected rejection

  // consider the following parser, which will accept `a` or `a b`
  // first we don't enable `ignoreEntryFollow`
  let { parser } = new ELR.AdvancedBuilder()
    .lexer(
      new Lexer.Builder()
        .ignore(Lexer.whitespaces())
        .define(Lexer.exactKind(..."ab"))
        .build(),
    )
    .define({ entry: `a b?` })
    .build({
      entry: "entry",
    });

  // when we parsing `a b`, the parser first evaluate { entry: `a` } and found next `b`
  // but `b` is not in `entry`'s follow set, so the parser rejects to accept { entry: `a` }
  // and the parser will try to evaluate { entry: `a b` } and accept it
  let res = parser.reset().parse("a b");
  expect(res.accept).toBe(true);
  expect(parser.lexer.getRest()).toBe("");

  // however, if we enable `ignoreEntryFollow`
  parser = new ELR.AdvancedBuilder()
    .lexer(
      new Lexer.Builder()
        .ignore(Lexer.whitespaces())
        .define(Lexer.exactKind(..."ab"))
        .build(),
    )
    .define({ entry: `a b?` })
    .build({
      entry: "entry",
      ignoreEntryFollow: true,
    }).parser;

  // the parser will accept { entry: `a` } immediately without checking the follow set
  // thus the `b` will never be parsed
  res = parser.reset().parse("a b");
  expect(res.accept).toBe(true);
  expect(parser.lexer.getRest()).toBe(" b");

  // as you can see, if the entry NT can be early accepted if we ignore entry follow,
  // we shouldn't use `ignoreEntryFollow`

  // TODO: can we check if the entry NT can be early accepted if we ignore entry follow?
  // how to check that if the grammar rule is nested or recursive?
  // if it can be checked, add it to builder.checkAll
});
