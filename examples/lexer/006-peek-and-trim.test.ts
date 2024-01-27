import { Lexer } from "../../src";

test("peek lexer", () => {
  // we can peek the next token without consuming it
  // and all muted tokens are not consumed as well
  const lexer = new Lexer.Builder()
    .ignore(/\s+/)
    .define({ A: /a/ })
    .build(" a");
  let peek = lexer.peek();
  let token = peek.token!;
  expect(token.kind).toBe("A");
  expect(peek.digested).toBe(2); // the space is also digested

  // now use `lex` to consume the token and the muted leading whitespace
  const res = lexer.lex();
  token = res.token!;
  expect(token.kind).toBe("A");
  expect(res.digested).toBe(2); // the space is also digested

  // however, peek-then-lex is not recommended
  // because actions are evaluated twice.
  // peek will return the mutated action state and how many chars are digested
  // we can directly apply them to the lexer if the peek result is what we want
  lexer.reload(" a");
  expect(lexer.state.digested).toBe(0);
  peek = lexer.peek();
  lexer.take(peek.digested, peek.actionState);
  expect(lexer.state.digested).toBe(2);

  // as you can see, peek will clone the action state
  // so there is still some overhead

  // another thing to mention is that
  // you can provide expectations when peek just like in lex
  lexer.reload(" a");
  peek = lexer.peek({ text: "b" });
  expect(peek.token).toBeUndefined();
});

test("trim lexer", () => {
  // if you want to peek different kinds of tokens
  // and there are muted tokens in the beginning of the rest of the buffer
  // then the muted tokens will be lexed multi times
  // which is not efficient

  const lexer = new Lexer.Builder()
    .ignore(/\s+/)
    .define({ A: /a/, B: /a/ })
    .build(" a");

  // for example, this peek will first ignore the whitespace then yield A
  let peek = lexer.peek({ kind: "A" });
  let token = peek.token!;
  expect(token.kind).toBe("A");
  expect(peek.digested).toBe(2); // the space is also digested

  // if then we do another peek with different expectation
  // the lexer will ignore the whitespace again
  peek = lexer.peek({ kind: "B" });
  token = peek.token!;
  expect(token.kind).toBe("B");
  expect(peek.digested).toBe(2); // the space is also digested

  // to avoid duplicated lexing, we can first trim the lexer to remove the muted tokens
  // then peek the rest of the buffer
  lexer.trim(); // this will consume the whitespace
  expect(lexer.state.digested).toBe(1);
  // now we can peek the rest of the buffer
  peek = lexer.peek({ kind: "A" });
  expect(peek.digested).toBe(1); // the whitespace is already consumed
  peek = lexer.peek({ kind: "B" });
  expect(peek.digested).toBe(1); // the whitespace is already consumed
});
