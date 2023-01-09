import {
  LR_BuilderError,
  LR_BuilderErrorType,
} from "../../../../src/parser/LR/builder/error";

function unwrap(f: () => void): LR_BuilderErrorType | null {
  try {
    f();
  } catch (e) {
    return (e as LR_BuilderError).type;
  }
  return null;
}

export function expect_unwrap(f: () => void) {
  return expect(unwrap(f));
}
