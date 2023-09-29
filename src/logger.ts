// TODO: rename this file to log.ts

export type LogData = {
  /**
   * Who is logging the message.
   */
  entity: "lexer" | "parser";
  /**
   * The message to be logged.
   */
  message: string;
  /**
   * These information will NOT be `JSON.stringify`-ed with the default log formatter,
   * and will be merged into `info` with the JSON log formatter.
   */
  // TODO: optimize the LogData design, remove raw?
  raw?: {
    [key: string]: string;
  };
  /**
   * Any additional information to be logged.
   * These information will be `JSON.stringify`-ed with the default log formatter.
   */
  info?: {
    [key: string]: unknown;
  };
};

export type LogFormatter = (data: LogData) => string;
export type LogPrinter = (log: string) => void;

/**
 * Format the log data into human readable format.
 */
export const defaultLogFormatter: LogFormatter = (data) => {
  // append function name and message as the header
  let res = `[${data.entity}] ${data.message}`;

  // append info if any
  for (const key in data.info) {
    const value = data.info[key];
    res += `\n${key}: ${JSON.stringify(value)}`;
  }

  // append raw if any
  for (const key in data.raw) {
    const value = data.raw[key];
    // indent the content if it contains newline
    if (value.includes("\n"))
      res += `\n${key}:\n  ${value.replace(/\n/g, "\n  ")}`;
    else res += `\n${key}: ${value}`;
  }

  return res;
};

/**
 * Format the log data into one-line-JSON format.
 *
 * This is useful for logging to a file then parsing the file later.
 */
export const jsonLogFormatter: LogFormatter = (data) => {
  return JSON.stringify({
    entity: data.entity,
    message: data.message,
    info: { ...data.info, ...data.raw },
  });
};

export class Logger {
  formatter: LogFormatter;
  printer: LogPrinter;

  constructor(props?: Partial<Pick<Logger, "formatter" | "printer">>) {
    this.formatter = props?.formatter ?? defaultLogFormatter;
    this.printer = props?.printer ?? console.log;
  }

  log(data: LogData) {
    this.printer(this.formatter(data));
  }
}

/**
 * Format the log data into human readable format
 * and print it to the console.
 */
export const defaultLogger = new Logger();
/**
 * Format the log data into one-line-JSON format
 * and print it to the console.
 */
export const jsonLogger = new Logger({ formatter: jsonLogFormatter });
