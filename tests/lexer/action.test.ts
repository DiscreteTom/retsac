import {
  Action,
  AcceptedActionOutput,
  ActionInput,
  ActionSource,
} from "../../src/lexer";

function expectAccept(
  buffer: string,
  src: ActionSource,
  override?: Partial<AcceptedActionOutput>
) {
  const input = new ActionInput({ buffer, start: 0 });
  const action = Action.from(src);
  const output = action.exec(input) as AcceptedActionOutput;
  expect(output.accept).toBe(true);
  expect(output.buffer).toBe(override?.buffer ?? buffer);
  expect(output.start).toBe(override?.start ?? 0);
  expect(output.digested).toBe(override?.digested ?? buffer.length);
  expect(output.content).toBe(override?.content ?? buffer);
  expect(output.rest).toBe(override?.rest ?? "");
  expect(output.error).toBe(override?.error ?? undefined);
  expect(output.muted).toBe(override?.muted ?? false);
}

function expectReject(buffer: string, src: ActionSource) {
  const input = new ActionInput({ buffer, start: 0 });
  const action = Action.from(src);
  const output = action.exec(input);
  expect(output.accept).toBe(false);
}

describe("Lexer action constructor", () => {
  test("from simple", () => {
    const buffer = "123";
    expectAccept(buffer, ({ buffer }) => buffer); // return string
    expectAccept(buffer, ({ buffer }) => buffer.length); // return number
    // simple accepted output
    expectAccept(buffer, ({ buffer }) => ({ content: buffer }));
    expectAccept(buffer, ({ buffer }) => ({ digested: buffer.length }));
    expectAccept(buffer, ({ buffer }) => ({
      digested: buffer.length,
      content: buffer,
      error: undefined,
      rest: "",
      muted: false,
    }));
  });

  test("from regex", () => {
    const buffer = "   ";
    expectAccept(buffer, /\s*/);
  });

  test("from another action", () => {
    const buffer = "   ";
    expectAccept(buffer, Action.from(/\s*/));
  });

  test("action constructor", () => {
    const buffer = "   ";
    expectAccept(
      buffer,
      new Action(
        ({ buffer }) =>
          new AcceptedActionOutput({
            digested: buffer.length,
            content: buffer,
            buffer,
            start: 0,
            muted: false,
          })
      )
    );
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
      Action.from(/\s*/).mute(({ content }) => content == buffer),
      { muted: true }
    );

    // not muted with a function
    expectAccept(
      buffer,
      Action.from(/\s*/).mute(({ content }) => content != buffer)
    );

    // not matched
    expectReject(buffer, Action.from(/123/).mute());
  });

  test("check action", () => {
    const buffer = "   ";
    const errMsg = "err msg";
    expectAccept(
      buffer,
      Action.from(/\s*/).check(({ content }) =>
        content == buffer ? undefined : errMsg
      )
    );

    expectReject(
      buffer,
      Action.from(/123/).check(({ content }) =>
        content == buffer ? undefined : errMsg
      )
    );

    expectAccept(
      buffer,
      Action.from(/\s*/).check(({ content }) =>
        content == buffer ? errMsg : undefined
      ),
      { error: errMsg }
    );
  });

  test("error action", () => {
    // if accept, set error
    expectAccept("123", Action.from(/123/).error("msg"), { error: "msg" });

    // if reject, do nothing
    expectReject("456", Action.from(/123/).error("msg"));
  });

  test("reject action", () => {
    const buffer = "   ";

    // accept
    expectAccept(buffer, Action.from(/\s*/));

    // reject with a function
    expectReject(
      buffer,
      Action.from(/\s*/).reject(({ content }) => content == buffer)
    );

    // directly reject
    expectReject(buffer, Action.from(/\s*/).reject());

    // reject with a value
    expectReject(buffer, Action.from(/\s*/).reject(true));
    expectAccept(buffer, Action.from(/\s*/).reject(false));

    // if already rejected, do nothing
    expectReject(buffer, Action.from(/123/).reject());
  });

  test("then action", () => {
    const buffer = "   ";
    let result = "";

    expectAccept(
      buffer,
      Action.from(/\s*/).then(({ content }) => (result = content))
    );
    expect(result).toBe(buffer);
  });
});

describe("sticky regex related", () => {
  test("auto sticky", () => {
    const buffer = "123123";
    const action = Action.from(/123/);
    const input = new ActionInput({ buffer, start: 3 });
    const output = action.exec(input) as AcceptedActionOutput;
    expect(output.accept).toBe(true);
    expect(output.buffer).toBe(buffer);
    expect(output.start).toBe(3);
    expect(output.digested).toBe(3);
    expect(output.content).toBe("123");
    expect(output.rest).toBe("");
    expect(output.error).toBe(undefined);
    expect(output.muted).toBe(false);
  });

  test("explicit sticky", () => {
    const buffer = "123123";
    const action = Action.from(/123/y);
    const input = new ActionInput({ buffer, start: 3 });
    const output = action.exec(input) as AcceptedActionOutput;
    expect(output.accept).toBe(true);
    expect(output.buffer).toBe(buffer);
    expect(output.start).toBe(3);
    expect(output.digested).toBe(3);
    expect(output.content).toBe("123");
    expect(output.rest).toBe("");
    expect(output.error).toBe(undefined);
    expect(output.muted).toBe(false);
  });

  test("disable auto sticky", () => {
    const buffer = "123123";
    const action = Action.match(/123/g, { autoSticky: false });
    const input = new ActionInput({ buffer, start: 3 });
    const output = action.exec(input) as AcceptedActionOutput;
    expect(output.accept).toBe(true);
    expect(output.buffer).toBe(buffer);
    expect(output.start).toBe(3);
    expect(output.digested).toBe(3);
    expect(output.content).toBe("123");
    expect(output.rest).toBe("");
    expect(output.error).toBe(undefined);
    expect(output.muted).toBe(false);
  });

  test("reject caret", () => {
    expect(() => Action.match(/^123/)).toThrow();
  });

  test("allow caret", () => {
    expect(() => Action.match(/^123/, { rejectCaret: false })).not.toThrow();
  });
});
