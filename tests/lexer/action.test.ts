import { Action, ActionOutput } from "../../src/lexer";

test("from simple", () => {
  const input = "123";
  expect(Action.from((buffer) => buffer.length).exec(input)).toEqual({
    accept: true,
    mute: false,
    digested: input.length,
    error: undefined,
  } as ActionOutput);
});

test("from regex", () => {
  const input = "   ";
  expect(Action.from(/^\s*/).exec(input)).toEqual({
    accept: true,
    mute: false,
    digested: input.length,
    error: undefined,
  } as ActionOutput);
});

test("from another action", () => {
  const input = "   ";
  const another = Action.from(/^\s*/);
  expect(Action.from(another).exec(input)).toEqual({
    accept: true,
    mute: false,
    digested: input.length,
    error: undefined,
  } as ActionOutput);
});

test("from exec", () => {
  const input = "   ";
  const output = {
    accept: true,
    mute: false,
    digested: input.length,
    error: undefined,
  } as ActionOutput;
  expect(new Action((buffer) => output).exec(input)).toEqual(output);
});

test("mute action", () => {
  const input = "   ";
  expect(Action.from(/^\s*/).mute().exec(input)).toEqual({
    accept: true,
    mute: true,
    digested: input.length,
    error: undefined,
  } as ActionOutput);

  expect(Action.from(/^123/).mute().exec(input)).toEqual({
    accept: false,
  } as ActionOutput);
});

test("check action", () => {
  const input = "   ";
  const errMsg = "err msg";
  expect(
    Action.from(/^\s*/)
      .check((content) => (content == input ? undefined : errMsg))
      .exec(input)
  ).toEqual({
    accept: true,
    mute: false,
    digested: input.length,
    error: undefined,
  } as ActionOutput);

  expect(
    Action.from(/^123/)
      .check((content) => (content == input ? undefined : errMsg))
      .exec(input)
  ).toEqual({ accept: false } as ActionOutput);

  expect(
    Action.from(/^\s*/)
      .check((content) => (content == input ? errMsg : undefined))
      .exec(input)
  ).toEqual({
    accept: true,
    mute: false,
    digested: input.length,
    error: errMsg,
  } as ActionOutput);
});

test("reject action", () => {
  const input = "   ";
  expect(Action.from(/^\s*/).exec(input)).toEqual({
    accept: true,
    mute: false,
    digested: input.length,
    error: undefined,
  } as ActionOutput);

  expect(
    Action.from(/^\s*/)
      .reject((content) => content == input)
      .exec(input)
  ).toEqual({ accept: false } as ActionOutput);
});

test("then action", () => {
  const input = "   ";
  let result = "";

  const output = Action.from(/^\s*/)
    .then((content) => (result = content))
    .exec(input);

  expect(output).toEqual({
    accept: true,
    mute: false,
    digested: input.length,
    error: undefined,
  } as ActionOutput);
  expect(result).toBe(input);
});