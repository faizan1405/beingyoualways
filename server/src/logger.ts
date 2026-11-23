// Structured JSON logs (one line per event). Values under sensitive keys and anything that
// looks like a connection string are redacted, so logs never contain credentials.
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level | "silent", number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const SENSITIVE = /pass(word)?|secret|token|cookie|authorization|api[-_]?key|database_url|hash/i;
const CONN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gi;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (typeof value === "string") return value.replace(CONN, (m) => m.replace(/:[^:@/]+@$/, ":[redacted]@"));
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redact(value.message) };
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1);
    return out;
  }
  return value;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export function createLogger(level: Level | "silent" = "info", write: (line: string) => void = (l) => process.stdout.write(l + "\n")): Logger {
  const log = (lvl: Level) => (msg: string, meta: Record<string, unknown> = {}) => {
    if (ORDER[lvl] < ORDER[level]) return;
    write(JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...(redact(meta) as Record<string, unknown>) }));
  };
  return { debug: log("debug"), info: log("info"), warn: log("warn"), error: log("error") };
}
