export type EscapeStarterInfo = {
  /**
   * The index of the start of the escape starter in the buffer.
   */
  index: number;
  /**
   * The length of the escape starter.
   */
  length: number;
};

export type EscapeInfo<ErrorKinds extends string> = {
  starter: Readonly<EscapeStarterInfo>;
  /**
   * The evaluated string value. Errors should be correctly handled.
   */
  value: string;
  /**
   * The length of the whole escape sequence, including the escape starter.
   */
  length: number;
  /**
   * `undefined` if no error.
   */
  error?: ErrorKinds;
};

export type EscapeHandlerOutput<ErrorKinds extends string> =
  | { accept: false }
  | ({
      accept: true;
      /**
       * The length of the escaped content, not include the escape starter.
       */
      length: number;
    } & Pick<EscapeInfo<ErrorKinds>, "value" | "error">);

export type EscapeHandler<ErrorKinds extends string> = (
  /**
   * The whole input text.
   *
   * `buffer.length` must be greater than `starter.index + starter.length`,
   * so it's safe to access `buffer[starter.index + starter.length]`.
   */
  buffer: string,
  starter: Readonly<EscapeStarterInfo>,
) => EscapeHandlerOutput<ErrorKinds>;
