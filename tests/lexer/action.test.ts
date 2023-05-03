import { Action, ActionAcceptedOutput, ActionOutput } from "../../src/lexer";

describe("Lexer action constructor", () => {
  test("from simple", () => {
    const input = "123";
    expect(Action.from((buffer) => buffer.length).exec(input)).toEqual({
      accept: true,
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput);
  });

  test("from regex", () => {
    const input = "   ";
    expect(Action.from(/^\s*/).exec(input)).toEqual({
      accept: true,
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput);
  });

  test("from another action", () => {
    const input = "   ";
    const another = Action.from(/^\s*/);
    expect(Action.from(another).exec(input)).toEqual({
      accept: true,
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput);
  });

  test("from exec", () => {
    const input = "   ";
    const output = {
      accept: true,
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput;
    expect(new Action((buffer) => output).exec(input)).toEqual(output);
  });
});

describe("Action decorator", () => {
  test("muted action", () => {
    const input = "   ";

    // muted
    expect(Action.from(/^\s*/).mute().exec(input)).toEqual({
      accept: true,
      muted: true,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput);

    // not muted
    expect(Action.from(/^\s*/).mute(false).exec(input)).toEqual({
      accept: true,
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput);

    // muted with a function
    expect(
      Action.from(/^\s*/)
        .mute((content) => content == input)
        .exec(input)
    ).toEqual({
      accept: true,
      muted: true,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput);

    // not muted with a function
    expect(
      Action.from(/^\s*/)
        .mute((content) => content != input)
        .exec(input)
    ).toEqual({
      accept: true,
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput);

    // not matched
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
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
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
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
      error: errMsg,
    } as ActionOutput);
  });

  test("error action", () => {
    // if accept, set error
    expect(
      (Action.from(/^123/).error("msg").exec("123") as ActionAcceptedOutput)
        .error
    ).toBe("msg");

    // if reject, do nothing
    expect(Action.from(/^123/).error("msg").exec("456")).toEqual({
      accept: false,
    });
  });

  test("reject action", () => {
    const input = "   ";

    // accept
    expect(Action.from(/^\s*/).exec(input)).toEqual({
      accept: true,
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput);

    // reject with a function
    expect(
      Action.from(/^\s*/)
        .reject((content) => content == input)
        .exec(input)
    ).toEqual({ accept: false } as ActionOutput);

    // directly reject
    expect(Action.from(/^\s*/).reject().exec(input)).toEqual({
      accept: false,
    } as ActionOutput);

    // reject with a value
    expect(Action.from(/^\s*/).reject(true).exec(input)).toEqual({
      accept: false,
    } as ActionOutput);
    expect(Action.from(/^\s*/).reject(false).exec(input).accept).toBe(true);

    // if already rejected, do nothing
    expect(Action.from(/^123/).reject().exec("456")).toEqual({
      accept: false,
    });
  });

  test("then action", () => {
    const input = "   ";
    let result = "";

    const output = Action.from(/^\s*/)
      .then((content) => (result = content))
      .exec(input);

    expect(output).toEqual({
      accept: true,
      muted: false,
      digested: input.length,
      content: input,
      rest: "",
      error: undefined,
    } as ActionOutput);
    expect(result).toBe(input);
  });
});
