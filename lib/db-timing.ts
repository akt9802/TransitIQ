import { appendFile, mkdir } from "fs/promises";
import path from "path";
import type { Pool, PoolClient } from "pg";

const LOG_PATH = path.join(process.cwd(), "logs", "db-timing.log");
const TIMED = Symbol.for("transitiq.queryTimed");

let ready: Promise<void> | null = null;
let queue: Promise<void> = Promise.resolve();

function ensureLogDir(): Promise<void> {
  ready ??= mkdir(path.dirname(LOG_PATH), { recursive: true }).then(() => undefined);
  return ready;
}

function sqlLabel(value: unknown): string {
  const text =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "text" in value && typeof value.text === "string"
        ? value.text
        : "";
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "(query)";
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
}

function writeLine(line: string) {
  const text = `${line}\n`;
  queue = queue
    .then(() => ensureLogDir())
    .then(() => appendFile(LOG_PATH, text))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("db timing log", message);
    });
}

type RequestMark = { id: string; route: string; t0: number };

type OpenRequest = {
  route: string;
  t0: number;
  queries: number;
  dbMs: number;
  lastEnd: number;
  timer: ReturnType<typeof setTimeout> | null;
  done: boolean;
};

const openRequests = new Map<string, OpenRequest>();

async function requestMark(): Promise<RequestMark> {
  const now = Date.now();
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const route = h.get("x-transitiq-route")?.trim() || "-";
    const id = h.get("x-transitiq-id")?.trim() || `${route}:${now}`;
    const t0 = Number(h.get("x-transitiq-t0"));
    return { id, route, t0: Number.isFinite(t0) && t0 > 0 ? t0 : now };
  } catch {
    return { id: `outside:${now}`, route: "-", t0: now };
  }
}

function finishRequest(id: string) {
  const row = openRequests.get(id);
  if (!row || row.done) return;
  row.done = true;
  if (row.timer) clearTimeout(row.timer);
  openRequests.delete(id);
  const tat = Math.max(0, row.lastEnd - row.t0);
  writeLine(
    `${new Date(row.lastEnd).toISOString()}\t${tat}ms\ttat\tqueries=${row.queries}\tdb=${row.dbMs}ms\t${row.route}`
  );
}

function noteRequest(mark: RequestMark, queryMs: number) {
  let row = openRequests.get(mark.id);
  if (!row) {
    row = { route: mark.route, t0: mark.t0, queries: 0, dbMs: 0, lastEnd: mark.t0, timer: null, done: false };
    openRequests.set(mark.id, row);
  }
  row.queries += 1;
  row.dbMs += queryMs;
  row.lastEnd = Date.now();
  if (row.timer) clearTimeout(row.timer);
  const id = mark.id;
  row.timer = setTimeout(() => finishRequest(id), 500);
}

function record(started: number, ok: boolean, rows: number | string, sql: string) {
  const ms = Math.round(performance.now() - started);
  void requestMark().then((mark) => {
    writeLine(
      `${new Date().toISOString()}\t${ms}ms\t${ok ? "ok" : "fail"}\trows=${rows}\t${mark.route}\t${sql}`
    );
    noteRequest(mark, ms);
  });
}

function rowCount(result: unknown): number | string {
  if (result && typeof result === "object" && "rowCount" in result && typeof result.rowCount === "number") {
    return result.rowCount;
  }
  return "-";
}

/** Time the client query once. Pool.query calls this with a callback, so the callback must still run. */
function instrument(client: PoolClient): PoolClient {
  const marked = client as PoolClient & { [TIMED]?: boolean };
  if (marked[TIMED]) return client;
  marked[TIMED] = true;
  const run = client.query.bind(client) as (...args: unknown[]) => unknown;
  client.query = ((...args: unknown[]) => {
    const sql = sqlLabel(args[0]);
    const started = performance.now();
    const last = args[args.length - 1];
    if (typeof last === "function") {
      const callback = last as (err: Error | undefined, result?: unknown) => void;
      args[args.length - 1] = (err: Error | undefined, result?: unknown) => {
        record(started, !err, err ? "-" : rowCount(result), sql);
        callback(err, result);
      };
      return run(...args);
    }
    return Promise.resolve(run(...args)).then(
      (result) => {
        record(started, true, rowCount(result), sql);
        return result;
      },
      (error: unknown) => {
        record(started, false, "-", sql);
        throw error;
      }
    );
  }) as PoolClient["query"];
  return client;
}

/** Time every Supabase query from this pool, including transaction clients. */
export function attachQueryTiming(pool: Pool): Pool {
  const connect = pool.connect.bind(pool) as (...args: unknown[]) => unknown;
  pool.connect = ((...args: unknown[]) => {
    const callback = args[0];
    if (typeof callback === "function") {
      return connect((err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => {
        callback(err, client ? instrument(client) : client, done);
      });
    }
    return (connect() as Promise<PoolClient>).then((client) => instrument(client));
  }) as Pool["connect"];
  return pool;
}
