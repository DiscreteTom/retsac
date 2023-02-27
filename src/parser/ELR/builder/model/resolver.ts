import { Condition } from "../../model";

export type RR_ResolverOptions<T> = {
  /** Default: true */
  reduce?: boolean | Condition<T>;
} & (
  | {
      next: (string & {}) | "*";
      handleEnd?: boolean;
    }
  | {
      next?: (string & {}) | "*";
      handleEnd: boolean;
    }
);

export type RS_ResolverOptions<T> = {
  next: (string & {}) | "*";
  /** Default: true */
  reduce?: boolean | Condition<T>;
};
