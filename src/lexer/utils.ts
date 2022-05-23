import { SimpleActionExec } from "./action";

export function from_to(
  from: string,
  to: string,
  acceptEof: boolean
): SimpleActionExec {
  return (buffer) => {
    if (buffer.startsWith(from)) {
      let index = buffer.indexOf(to, from.length);
      if (index == -1)
        // not found
        return acceptEof
          ? // accept whole buffer
            buffer.length
          : // reject
            0;
      else return index + to.length;
    }
    return 0;
  };
}

export function exact(s: string): SimpleActionExec {
  return (buffer) => (buffer.startsWith(s) ? s.length : 0);
}
