import type { ActionSource } from "../../src/lexer";
import {
  Action,
  AcceptedActionOutput,
  ActionInput,
  CaretNotAllowedError,
} from "../../src/lexer";

function expectAccept<E>(
  buffer: string,
  src: ActionSource<E>,
  override?: Partial<AcceptedActionOutput<E>>,
) {
  const action = Action.from(src);

  // normal test
  let input = new ActionInput({ buffer, start: 0, rest: buffer });
  let output = action.exec(input) as AcceptedActionOutput<E>;
  expect(output.accept).toBe(true);
  expect(output.buffer).toBe(override?.buffer ?? buffer);
  expect(output.start).toBe(override?.start ?? 0);
  expect(output.digested).toBe(override?.digested ?? buffer.length);
  expect(output.content).toBe(override?.content ?? buffer);
  expect(output.rest).toBe(override?.rest ?? "");
  expect(output.error).toBe(override?.error ?? undefined);
  expect(output.muted).toBe(override?.muted ?? false);

  // additional test for #6
  // set start to 1 to verify that action's output's digest is not affected
  const newBuffer = " " + buffer;
  input = new ActionInput({ buffer: newBuffer, start: 1 });
  output = action.exec(input) as AcceptedActionOutput<E>;
  expect(output.accept).toBe(true);
  expect(output.buffer).toBe(" " + (override?.buffer ?? buffer));
  expect(output.start).toBe((override?.start ?? 0) + 1);
  expect(output.digested).toBe(override?.digested ?? buffer.length);
  expect(output.content).toBe(override?.content ?? buffer);
  expect(output.rest).toBe(override?.rest ?? "");
  expect(output.error).toBe(override?.error ?? undefined);
  expect(output.muted).toBe(override?.muted ?? false);
}

function expectReject<E>(buffer: string, src: ActionSource<E>) {
  const action = Action.from(src);
  const input = new ActionInput({ buffer, start: 0 });
  const output = action.exec(input);
  expect(output.accept).toBe(false);
}

describe("Lexer action constructor", () => {
  test("from simple", () => {
    const buffer = "123";
    expectAccept(buffer, ({ rest }) => rest); // return string, accept
    expectReject(buffer, () => ""); // return string, reject
    expectAccept(buffer, ({ buffer, start }) => buffer.length - start); // return number, accept
    expectReject(buffer, () => 0); // return number, reject
    // simple accepted output
    expectAccept(buffer, ({ rest }) => ({
      content: rest,
    }));
    expectReject(buffer, () => ({ content: "" }));
    expectAccept(buffer, ({ buffer, start }) => ({
      digested: buffer.length - start,
    }));
    expectReject(buffer, () => ({ digested: 0 }));
    expectAccept(buffer, ({ rest }) => ({
      digested: rest.length,
      content: rest,
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
        ({ rest, buffer, start }) =>
          new AcceptedActionOutput({
            digested: rest.length,
            content: rest,
            buffer,
            start,
            muted: false,
          }),
      ),
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
      { muted: true },
    );

    // not muted with a function
    expectAccept(
      buffer,
      Action.from(/\s*/).mute(({ content }) => content != buffer),
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
        content == buffer ? undefined : errMsg,
      ),
    );

    expectReject(
      buffer,
      Action.from(/123/).check(({ content }) =>
        content == buffer ? undefined : errMsg,
      ),
    );

    expectAccept(
      buffer,
      Action.from(/\s*/).check(({ content }) =>
        content == buffer ? errMsg : undefined,
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

  test("reject action", () => {
    const buffer = "   ";

    // accept
    expectAccept(buffer, Action.from(/\s*/));

    // reject with a function
    expectReject(
      buffer,
      Action.from(/\s*/).reject(({ content }) => content == buffer),
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
      Action.from(/\s*/).then(({ content }) => (result = content)),
    );
    expect(result).toBe(buffer);
  });
});

describe("sticky regex related", () => {
  test("auto sticky", () => {
    const buffer = "123123";
    const action = Action.from(/123/);
    const input = new ActionInput({ buffer, start: 3 });
    const output = action.exec(input) as AcceptedActionOutput<string>;
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
    const output = action.exec(input) as AcceptedActionOutput<string>;
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
    const output = action.exec(input) as AcceptedActionOutput<string>;
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
    expect(() => Action.match(/^123/)).toThrow(CaretNotAllowedError);
  });

  test("allow caret", () => {
    expect(() => Action.match(/^123/, { rejectCaret: false })).not.toThrow(
      CaretNotAllowedError,
    );
  });
});
