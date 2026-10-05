export type LogFields = Record<string, unknown>;

export interface Logger {
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

/** One JSON line per event on stdout so any log shipper can parse it. */
export function createLogger(service: string, base: LogFields = {}): Logger {
  const write = (level: string, msg: string, fields: LogFields = {}) =>
    console.log(JSON.stringify({ time: new Date().toISOString(), level, service, msg, ...base, ...fields }));
  return {
    info: (msg, fields) => write("info", msg, fields),
    warn: (msg, fields) => write("warn", msg, fields),
    error: (msg, fields) => write("error", msg, fields),
    child: (fields) => createLogger(service, { ...base, ...fields }),
  };
}
