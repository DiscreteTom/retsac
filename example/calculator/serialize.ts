import { ELR } from "../../src";
import { parser } from "./core";
import { writeFileSync } from "fs";

const dfaStr = JSON.stringify(
  (parser as ELR.Parser<any, any>).dfa.toSerializable()
);

writeFileSync("./example/calculator/dfa.json", dfaStr);
