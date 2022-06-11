import { parser } from "./core";

console.log(parser.parse("(2+3)*4/5")[0].toString());
