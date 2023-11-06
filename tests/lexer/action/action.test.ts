import type { IntoAction, AcceptedActionOutput } from "../../../src/lexer";
import { Action, ActionInput, CaretNotAllowedError } from "../../../src/lexer";

function expectAccept<Kinds extends string, Data, ErrorType>(
  buffer: string,
  src: IntoAction<Kinds, Data, never, ErrorType>,
  override?: Partial<
    Omit<AcceptedActionOutput<Kinds, Data, ErrorType>, "rest"> & {
      rest: string;
    }
  >,
) {
  const action = Action.from(src);

  // normal test
  const input = new ActionInput({
    buffer,
    start: 0,
    rest: buffer,
    state: undefined as never,
    peek: false,
  });
  const output = action.exec(input) as AcceptedActionOutput<
    Kinds,
    Data,
    ErrorType
  >;
  expect(output.accept).toBe(true);
  expect(output.buffer).toBe(override?.buffer ?? buffer);
  expect(output.start).toBe(override?.start ?? 0);
  expect(output.digested).toBe(override?.digested ?? buffer.length);
  expect(output.content).toBe(override?.content ?? buffer);
  expect(output.rest.value).toBe(override?.rest ?? "");
  expect(output.error).toBe(override?.error ?? undefined);
  expect(output.muted).toBe(override?.muted ?? false);
  expect(output.data).toBe(override?.data ?? undefined);
  expect(output.kind).toBe(override?.kind ?? undefined);

  // additional test for #6
  // set start to 1 to verify that action's output's digest is not affected
  const newBuffer = " " + buffer;
  const newInput = new ActionInput({
    buffer: newBuffer,
    start: 1,
    state: undefined as never,
    peek: false,
    rest: undefined,
  });
  const newOutput = action.exec(newInput) as AcceptedActionOutput<
    Kinds,
    Data,
    ErrorType
  >;
  expect(newOutput.accept).toBe(true);
  expect(newOutput.buffer).toBe(" " + (override?.buffer ?? buffer));
  expect(newOutput.start).toBe((override?.start ?? 0) + 1);
  expect(newOutput.digested).toBe(override?.digested ?? buffer.length);
  expect(newOutput.content).toBe(override?.content ?? buffer);
  expect(newOutput.rest.value).toBe(override?.rest ?? "");
  expect(newOutput.error).toBe(override?.error ?? undefined);
  expect(newOutput.muted).toBe(override?.muted ?? false);
  expect(newOutput.data).toBe(override?.data ?? undefined);
  expect(newOutput.kind).toBe(override?.kind ?? undefined);
}

function expectReject<Kinds extends string, Data, ErrorType>(
  buffer: string,
  src: IntoAction<Kinds, Data, never, ErrorType>,
) {
  const input = new ActionInput({
    buffer,
    start: 0,
    state: undefined as never,
    peek: false,
    rest: undefined,
  });
  expect(Action.from(src).exec(input).accept).toBe(false);
}

describe("Lexer action constructor", () => {
  test("from exec", () => {
    const buffer = "   ";
    expectAccept(
      buffer,
      Action.exec(({ rest }) => ({
        accept: true,
        data: undefined as never,
        digested: rest.value.length,
        content: rest.value,
        muted: false,
      })),
    );
  });

  test("from simple", () => {
    const buffer = "123";
    expectAccept(buffer, ({ rest }) => rest.value); // return string, accept
    expectReject(buffer, () => ""); // return string, reject
    expectAccept(buffer, ({ rest }) => rest.value.length); // return number, accept
    expectReject(buffer, () => 0); // return number, reject
    // simple accepted output
    expectAccept(buffer, ({ rest }) => ({
      content: rest.value,
    }));
    expectReject(buffer, () => ({ content: "" }));
    expectAccept(buffer, ({ rest }) => ({
      digested: rest.value.length,
    }));
    expectReject(buffer, () => ({ digested: 0 }));
    expectAccept(buffer, ({ rest }) => ({
      digested: rest.value.length,
      content: rest.value,
      error: undefined,
      muted: false,
    }));
    // ensure data is undefined by default
    expectAccept(buffer, ({ rest }) => ({
      content: rest.value,
    }));
    // ensure data can be set correctly
    expectAccept(
      buffer,
      ({ rest }) => ({
        content: rest.value,
        data: 123,
      }),
      { data: 123 },
    );
  });

  test("match regex with data", () => {
    const input = new ActionInput({
      buffer: "   ",
      start: 0,
      rest: undefined,
      state: undefined as never,
      peek: false,
    });
    const action = Action.match(/\s*/);
    expect(
      (
        action.exec(input) as AcceptedActionOutput<
          never,
          RegExpExecArray,
          never
        >
      ).data[0],
    ).not.toBe(null);
  });

  test("dry match, no data", () => {
    const buffer = "   ";
    expectAccept(buffer, Action.dryMatch(/\s*/));
  });

  test("from regex, no data", () => {
    const buffer = "   ";
    expectAccept(buffer, /\s*/);
  });

  test("from another action", () => {
    const buffer = "   ";
    expectAccept(buffer, Action.from(/\s*/));
  });
});

describe("Action decorator", () => {
  test("muted action", () => {
    const buffer = "   ";

    // muted
    expectAccept(buffer, Action.from(/\s*/).mute(), { muted: true });

    // not muted
    expectAccept(buffer, Action.from(/\s*/).mute(false));

    // muted with a function
    expectAccept(
      buffer,
      Action.from(/\s*/).mute(({ output }) => output.content === buffer),
      { muted: true },
    );

    // not muted with a function
    expectAccept(
      buffer,
      Action.from(/\s*/).mute(({ output }) => output.content !== buffer),
    );

    // not matched
    expectReject(buffer, Action.from(/123/).mute());
  });

  test("check action", () => {
    const buffer = "   ";
    const errMsg = "err msg";
    expectAccept(
      buffer,
      Action.from(/\s*/).check(({ output }) =>
        output.content === buffer ? undefined : errMsg,
      ),
    );

    expectReject(
      buffer,
      Action.from(/123/).check(({ output }) =>
        output.content === buffer ? undefined : errMsg,
      ),
    );

    expectAccept(
      buffer,
      Action.from(/\s*/).check(({ output }) =>
        output.content === buffer ? (errMsg as string) : undefined,
      ),
      { error: errMsg },
    );
  });

  test("error action", () => {
    // if accept, set error
    expectAccept("123", Action.from(/123/).error("msg"), { error: "msg" });

    // if reject, do nothing
    expectReject("456", Action.from(/123/).error("msg"));
  });

  test("set action data", () => {
    const buffer = "123";
    expectAccept(
      buffer,
      Action.from(/123/).data(() => "data"),
      { data: "data" },
    );
  });

  test("clear action data", () => {
    const buffer = "123";
    expectAccept(
      buffer,
      Action.from(/123/)
        .data(() => "data")
        .purge(),
    );
  });

  test("reject action", () => {
    const buffer = "   ";

    // accept
    expectAccept(buffer, Action.from(/\s*/));

    // reject with a function
    expectReject(
      buffer,
      Action.from(/\s*/).reject(({ output }) => output.content === buffer),
    );

    // directly reject
    expectReject(buffer, Action.from(/\s*/).reject());

    // reject with a value
    expectReject(buffer, Action.from(/\s*/).reject(true));
    expectAccept(buffer, Action.from(/\s*/).reject(false));

    // if already rejected, do nothing
    expectReject(buffer, Action.from(/123/).reject());
  });

  test("bind action kind", () => {
    expectAccept("123", Action.from(/123/).bind("num"), { kind: "num" });
  });

  test("set multi kinds", () => {
    const a = Action.from(/\d+/)
      .kinds("odd", "even")
      .select(({ output }) =>
        Number(output.content) % 2 === 0 ? "even" : "odd",
      );
    expectAccept("1", a, { kind: "odd" });
    expectAccept("2", a, { kind: "even" });
  });

  test("map multi kinds data", () => {
    const a = Action.from(/\d+/)
      .kinds("odd", "even")
      .select(({ output }) =>
        Number(output.content) % 2 === 0 ? "even" : "odd",
      )
      .map({
        odd: (ctx) => `odd: ${ctx.output.content}`,
        even: (ctx) => Number(ctx.output.content),
      });
    expectAccept<"odd" | "even", string | number, never>("1", a, {
      data: "odd: 1",
      kind: "odd",
    });
    expectAccept<"odd" | "even", string | number, never>("2", a, {
      data: 2,
      kind: "even",
    });
  });
});

describe("maybe muted", () => {
  test("default maybe muted should be false", () => {
    expect(Action.from(/123/).maybeMuted).toBe(false);
  });

  test("use mute decorator", () => {
    expect(Action.from(/123/).mute().maybeMuted).toBe(true);
    expect(Action.from(/123/).mute(false).maybeMuted).toBe(false);
    // if muted is a function, always return true
    expect(Action.from(/123/).mute(() => false).maybeMuted).toBe(true);
    expect(Action.from(/123/).mute(() => true).maybeMuted).toBe(true);
  });
});

describe("sticky regex related", () => {
  test("auto sticky", () => {
    const buffer = "123123";
    const action = Action.from(/123/);
    const input = new ActionInput({
      buffer,
      start: 3,
      state: undefined as never,
      peek: false,
      rest: undefined,
    });
    const output = action.exec(input) as AcceptedActionOutput<
      never,
      never,
      string
    >;
    expect(output.accept).toBe(true);
    expect(output.buffer).toBe(buffer);
    expect(output.start).toBe(3);
    expect(output.digested).toBe(3);
    expect(output.content).toBe("123");
    expect(output.rest.value).toBe("");
    expect(output.error).toBe(undefined);
    expect(output.muted).toBe(false);
  });

  test("explicit sticky", () => {
    const buffer = "123123";
    const action = Action.from(/123/y);
    const input = new ActionInput({
      buffer,
      start: 3,
      state: undefined as never,
      peek: false,
      rest: undefined,
    });
    const output = action.exec(input) as AcceptedActionOutput<
      never,
      never,
      string
    >;
    expect(output.accept).toBe(true);
    expect(output.buffer).toBe(buffer);
    expect(output.start).toBe(3);
    expect(output.digested).toBe(3);
    expect(output.content).toBe("123");
    expect(output.rest.value).toBe("");
    expect(output.error).toBe(undefined);
    expect(output.muted).toBe(false);
  });

  test("disable auto sticky", () => {
    const buffer = "123123";
    const action = Action.match(/123/g, { autoSticky: false });
    const input = new ActionInput({
      buffer,
      start: 3,
      state: undefined as never,
      peek: false,
      rest: undefined,
    });
    const output = action.exec(input) as AcceptedActionOutput<
      never,
      RegExpExecArray,
      never
    >;
    expect(output.accept).toBe(true);
    expect(output.buffer).toBe(buffer);
    expect(output.start).toBe(3);
    expect(output.digested).toBe(3);
    expect(output.content).toBe("123");
    expect(output.rest.value).toBe("");
    expect(output.error).toBe(undefined);
    expect(output.muted).toBe(false);
  });

  test("reject caret", () => {
    expect(() => Action.match(/^123/)).toThrow(CaretNotAllowedError);
  });

  test("allow caret", () => {
    expect(() => Action.match(/^123/, { rejectCaret: false })).not.toThrow(
      CaretNotAllowedError,
    );
  });
});

describe("peek & then", () => {
  test("update action state in Action.then when accept", () => {
    const state = {
      value: 0,
    };
    Action.from<never, never, typeof state>(/123/)
      .then(({ input }) => (input.state.value = 1))
      .exec(
        new ActionInput({
          buffer: "123", // accept
          start: 0,
          state,
          peek: false,
          rest: undefined,
        }),
      );
    expect(state.value).toBe(1);
  });

  test("don't update state when reject", () => {
    const state = {
      value: 0,
    };
    Action.from<never, never, typeof state>(/123/)
      .then(({ input }) => (input.state.value = 1))
      .exec(
        new ActionInput({
          buffer: "12", // reject
          start: 0,
          state,
          peek: false,
          rest: undefined,
        }),
      );
    expect(state.value).toBe(0);
  });

  test("peek won't update action state", () => {
    const state = {
      value: 0,
    };
    Action.from<never, never, typeof state>(/123/)
      .then(({ input }) => (input.state.value = 1))
      .exec(
        new ActionInput({
          buffer: "123",
          start: 0,
          state,
          peek: true,
          rest: undefined,
        }),
      );
    expect(state.value).toBe(0);
  });
});
