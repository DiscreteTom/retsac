import { manager } from "./core";

function assertEqual(input: string, desired: number) {
  manager.reset();
  let res = manager.parseAll(input);
  if (!res.accept || res.buffer.length != 1)
    throw new Error(
      `Reduce failed for input "${input}". Result: ${res.buffer}`
    );
  if (res.buffer[0].data.value != desired)
    throw new Error(
      `Wrong result. Input: "${input}", want: ${desired}, got: ${res.buffer[0].data.value}`
    );
}

assertEqual("1+1", 2);
assertEqual("-1-2", -3);
assertEqual("1 - -1", 2);
assertEqual("2+3*4/5", 4.4);
assertEqual("(2+3)*4/5", 4);
assertEqual("2+3*(4/5)", 4.4);

console.log("All check passed.");
