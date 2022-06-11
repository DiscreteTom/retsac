import { parser } from "./core";

function assertEqual(input: string, desired: number) {
  parser.reset();
  let res = parser.parse(input);
  if (res.length != 1)
    throw new Error(`Reduce failed for input "${input}". Result: ${res}`);
  if (res[0].data.value != desired)
    throw new Error(
      `Wrong result. Input: "${input}", want: ${desired}, got: ${res[0].data.value}`
    );
}

assertEqual("1+1", 2);
assertEqual("-1-2", -3);
assertEqual("1 - -1", 2);
assertEqual("2+3*4/5", 4.4);
assertEqual("(2+3)*4/5", 4);

console.log("All check passed.");
