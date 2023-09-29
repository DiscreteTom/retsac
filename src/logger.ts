// TODO: rename this file to log.ts

export type LogData = {
  /**
   * Who is logging the message.
   */
  entity: string;
  /**
   * The message to be logged.
   * The value should already be human readable.
   */
  message?: string;
  /**
   * Any additional information to be logged.
   * This is useful to be inspected with the JSON logger.
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
  return `[${data.entity}] ${data.message}`;
};

/**
 * Format the log data into one-line-JSON format.
 *
 * This is useful for logging to a file then parsing the file later.
 */
export const jsonLogFormatter: LogFormatter = (data) => {
  return JSON.stringify(data);
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
