// src/cli.mjs
import minimist from "minimist";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { openDb } from "./lib/db.mjs";
import { printTable } from "./lib/printTable.mjs";
import { writeCSV, writeJSON } from "./lib/export.mjs";
import { writeChartHTML } from "./lib/chart.mjs";

// ---- args / flags ----
const args = minimist(process.argv.slice(2), {
  alias: { q: "query", o: "out", h: "help", d: "db", f: "file", c: "chart", x: "x", y: "y" },
  boolean: ["help", "repl"],
  default: { repl: false, chartOut: "out/chart.html" }
});

// normalize --chart-out
if (args["chart-out"] && !args.chartOut) args.chartOut = args["chart-out"];

// MINIMIST SAFETY: coerce possibly-repeated flags to a single value
function single(v) { return Array.isArray(v) ? v[0] : v; }
if (Array.isArray(args.x)) args.x = args.x[0];
if (Array.isArray(args.y)) args.y = args.y[0];
if (Array.isArray(args.chart)) args.chart = args.chart[0];
if (Array.isArray(args.file)) args.file = args.file[0];
if (Array.isArray(args.db)) args.db = args.db[0];
// allow multiple --open but flatten nested arrays
if (Array.isArray(args.open)) args.open = args.open.flat();

// sanitize col flags like "genre,genre" -> "genre"
function sanitizeColFlag(val) {
  if (val == null) return val;
  const s = String(val).trim();
  if (!s) return s;
  if (s.includes(",")) return s.split(",")[0].trim();
  return s;
}

if (args.help) {
  usage();
  process.exit(0);
}

const dbFile = args.db || ":memory:";
const openPatterns = [
  ...(Array.isArray(args.open) ? args.open : (args.open ? [args.open] : [])),
  ...args._
];

const { run, all, close } = openDb(dbFile);

// state for export/chart
let lastSql = null;
let lastRows = null;

// ---------- helpers ----------
const esc = s => String(s).replace(/'/g, "''");

function deriveViewName(p, used = new Set()) {
  let base = path.basename(String(p)).replace(/\.[^.]+$/,"");
  base = base.replace(/[^A-Za-z0-9_]+/g, "_");
  if (!/^[A-Za-z_]/.test(base)) base = "v_" + base;
  if (!base) base = "view";
  let name = base, i = 2;
  while (used.has(name)) name = `${base}_${i++}`;
  used.add(name);
  return name;
}

async function listTables() {
  return all(`
    select table_name, table_type
    from information_schema.tables
    where table_schema='main'
    order by table_type, table_name;
  `);
}

async function describeTable(name) {
  return all(`pragma table_info('${esc(name)}');`);
}

async function mountOne(p, asName = null) {
  const used = await listTables().then(ts => new Set(ts.map(t => t.table_name)));
  const name = asName || deriveViewName(p, used);
  const lower = String(p).toLowerCase();
  const isParquet = /\.parquet(\.gz)?$/.test(lower) || lower.endsWith(".parq") || lower.includes("*.parquet");
  const sql = isParquet
    ? `create or replace view ${name} as select * from '${esc(p)}';`
    : `create or replace view ${name} as select * from read_csv_auto('${esc(p)}');`;
  await run(sql);
  console.log(`mounted → view ${name} ⟵ ${p}`);
  return name;
}

async function mount(patterns) {
  for (const p of patterns) await mountOne(p, null);
}

async function execAndOutput(sql, outFile) {
  lastSql = sql;
  lastRows = await all(sql);
  printTable(lastRows);
  if (outFile) await exportFromLast(outFile);
}

async function exportFromLast(outPathOrFormat) {
  if (!lastRows && !lastSql) throw new Error("Nothing to export yet. Run a query first.");
  const out = outPathOrFormat;
  const ext = path.extname(out).toLowerCase();
  const outPath = out;

  if (!ext && (out === "csv" || out === "json" || out === "parquet")) {
    throw new Error("Please provide an output path, e.g. .export csv out/result.csv");
  }

  if (ext === ".csv") {
    await writeCSV(outPath, lastRows || []);
    console.log(`\nexported → ${outPath}`);
  } else if (ext === ".json") {
    await writeJSON(outPath, lastRows || []);
    console.log(`\nexported → ${outPath}`);
  } else if (ext === ".parquet") {
    if (!lastSql) throw new Error("Parquet export requires a SQL context. Run a query first.");
    const sql = `COPY (${lastSql}) TO '${esc(outPath)}' (FORMAT 'parquet');`;
    await run(sql);
    console.log(`\nexported → ${outPath}`);
  } else {
    throw new Error(`Unsupported export extension: ${ext || "(none)"} (use .csv, .json, .parquet)`);
  }
}

// -------- charting: robust resolution, coercion, auto-detect fallback --------
const normKey = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_");
function buildKeyMap(row) {
  const map = new Map();
  for (const k of Object.keys(row || {})) map.set(normKey(k), k);
  return map;
}
function coerceToPlain(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === "number" || typeof v === "string" || typeof v === "bigint" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    try {
      const vv = typeof v.valueOf === "function" ? v.valueOf() : v;
      if (typeof vv === "number" || typeof vv === "bigint" || typeof vv === "string") return vv;
      return String(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
function coerceNumberSmart(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  let s = typeof v === "string" ? v : String(v);
  s = s.trim();
  if (!s) return NaN;

  // decide decimal separator by last occurrence
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma !== -1 && lastDot === -1) {
    s = s.replace(",", ".");
  } else {
    s = s.replace(/(?<=\d)[,_\s](?=\d{3}\b)/g, "");
  }

  const m = s.match(/^[+\-]?\d*(?:\.\d+)?(?:[eE][+\-]?\d+)?$/);
  const cleaned = m ? m[0] : s;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}
function assembleSeries(rows, xKey, yKey) {
  const labels = [];
  const data = [];
  for (const r of rows) {
    const lx = r[xKey];
    const vy = r[yKey];
    const num = coerceNumberSmart(vy);
    if (lx !== undefined && lx !== null && Number.isFinite(num)) {
      labels.push(String(lx));
      data.push(num);
    }
  }
  return { labels, data };
}
function autoPickXY(rows) {
  const keys = Object.keys(rows[0] || {});
  let x = null;
  for (const k of keys) {
    const v = rows[0][k];
    if (!Number.isFinite(coerceNumberSmart(v))) { x = k; break; }
  }
  let y = null;
  for (const k of keys) {
    if (k === x) continue;
    const v = rows[0][k];
    if (Number.isFinite(coerceNumberSmart(v))) { y = k; break; }
  }
  return { x, y };
}

async function chartFromLast(type, xcol, ycol, outPath = "out/chart.html") {
  if (!lastRows || !Array.isArray(lastRows) || lastRows.length === 0) {
    throw new Error("Run a query first so there's data to chart.");
  }

  // materialize to plain JS values
  const plainRows = lastRows.map(r => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = coerceToPlain(v);
    return o;
  });

  const keyMap = buildKeyMap(plainRows[0]);
  const resolve = (wanted) => keyMap.get(normKey(wanted)) ?? wanted;

  // sanitize incoming flags (handles "genre,genre" case)
  let rx = xcol === "auto" ? null : resolve(sanitizeColFlag(xcol));
  let ry = ycol === "auto" ? null : resolve(sanitizeColFlag(ycol));

  // try requested columns first (if provided)
  let { labels, data } = (rx && ry) ? assembleSeries(plainRows, rx, ry) : { labels: [], data: [] };

  // fallback to auto-detect if nothing chartable or if user asked for auto
  if (labels.length === 0 || xcol === "auto" || ycol === "auto") {
    const { x, y } = autoPickXY(plainRows);
    rx = rx || x;
    ry = ry || y;
    ({ labels, data } = assembleSeries(plainRows, rx, ry));
  }

  if (labels.length === 0) {
    const cols = Object.keys(plainRows[0] || {});
    const sample = plainRows[0] || {};
    throw new Error(
      `No chartable rows (y must be numeric).\n` +
      `Columns: ${cols.join(", ") || "(none)"}\n` +
      `Tried x='${xcol}'(→'${rx}'), y='${ycol}'(→'${ry}')\n` +
      `Sample: ${JSON.stringify(sample)}`
    );
  }

  const resolvedTitle = (xcol === "auto" || ycol === "auto")
    ? `${type.toUpperCase()} • ${rx} vs ${ry}`
    : `${type.toUpperCase()} • ${xcol} vs ${ycol}`;

  await writeChartHTML(outPath, { title: resolvedTitle, type, labels, data });
  console.log(`chart → ${outPath}`);
}

async function readSqlFile(filePath) {
  const txt = await fs.readFile(filePath, "utf8");
  return txt.trim().replace(/;\s*$/, "");
}

function usage() {
  console.log(`
duckdb-playground — query CSV/Parquet via DuckDB

Usage:
  node src/cli.mjs [--open <fileOrGlob> ...] [-q <sql>] [-o out.csv|out.json|out.parquet] [--db file.duckdb]
  node src/cli.mjs --repl [--open <fileOrGlob> ...] [--db file.duckdb]

Options:
  --open, (positional)   CSV/Parquet file(s) or globs to mount as views
  -q, --query            Run a single SQL query and exit
  -o, --out              Export query result to CSV/JSON/Parquet
  -d, --db               Use a DuckDB database file (default: :memory:)
  -f, --file             Read SQL from a file (runs instead of -q)
  -c, --chart            Chart type for one-shot (bar|line|scatter|auto)
  --x, --y               Column names for chart axes (used with --chart); use "auto" to auto-pick
  --chart-out            Output HTML path for chart (default: out/chart.html)
  --repl                 Force REPL (default if no -q)
  -h, --help             Show this help

REPL meta commands:
  .help                          Show help
  .tables                        List tables/views
  .schema <name>                 Show columns for a table/view
  .open <fileOrGlob> [AS name]   Mount additional files as named view
  .drop <view>                   Drop a view
  .sample <view> [n]             Preview first n rows (default 5)
  .export <path>                 Export last result by extension (.csv/.json/.parquet)
  .chart <bar|line|scatter|auto> <xcol|auto> <ycol|auto> [out.html]  Build a chart
  .exit                          Quit
`);
}

async function startRepl() {
  const histFile = path.join(os.homedir(), ".duckie_history");
  const history = await loadHistory(histFile);
  console.log("DuckDB REPL — end SQL with ';'  |  .help for commands");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "duckdb> "
  });
  rl.history = history;

  return await new Promise((resolve) => {
    let buffer = "";

    rl.prompt();

    rl.on("line", async (line) => {
      const trimmed = line.trim();

      // meta commands (only when not mid-statement)
      if (!buffer && trimmed.startsWith(".")) {
        const [cmd, ...rest] = trimmed.split(/\s+/);
        try {
          if (cmd === ".help") {
            usage();
          } else if (cmd === ".tables") {
            printTable(await listTables());
          } else if (cmd === ".schema") {
            if (!rest[0]) console.log("usage: .schema <name>");
            else printTable(await describeTable(rest[0]));
          } else if (cmd === ".open") {
            if (!rest.length) {
              console.log("usage: .open <fileOrGlob> [AS name]");
            } else {
              const asIdx = rest.findIndex(x => x.toLowerCase() === "as");
              if (asIdx >= 0) {
                const file = rest.slice(0, asIdx).join(" ");
                const vname = rest.slice(asIdx + 1).join(" ");
                if (!file || !vname) {
                  console.log("usage: .open <fileOrGlob> [AS name]");
                } else {
                  await mountOne(file, vname);
                }
              } else {
                for (const p of rest) await mountOne(p, null);
              }
            }
          } else if (cmd === ".drop") {
            if (!rest[0]) console.log("usage: .drop <view>");
            else await run(`drop view if exists ${rest[0]};`);
          } else if (cmd === ".sample") {
            if (!rest[0]) console.log("usage: .sample <view> [n]");
            else {
              const n = Number(rest[1]) > 0 ? Number(rest[1]) : 5;
              const sql = `select * from ${rest[0]} limit ${n}`;
              lastSql = sql;
              lastRows = await all(sql);
              printTable(lastRows);
            }
          } else if (cmd === ".export") {
            if (!rest[0]) console.log("usage: .export <path.{csv|json|parquet}>");
            else await exportFromLast(rest.join(" "));
          } else if (cmd === ".chart") {
            if (rest.length < 1) {
              console.log("usage: .chart <bar|line|scatter|auto> <xcol|auto> <ycol|auto> [out.html]");
            } else {
              let [type, xcol = "auto", ycol = "auto", out] = rest;
              type = (type || "bar").toLowerCase();
              if (!["bar","line","scatter","auto"].includes(type)) {
                console.log("type must be bar|line|scatter|auto");
              } else {
                if (type === "auto") type = "bar";
                const outPath = out || "out/chart.html";
                await chartFromLast(type, xcol, ycol, outPath);
              }
            }
          } else if (cmd === ".exit") {
            rl.close();
            return;
          } else {
            console.log(`unknown command: ${cmd}`);
          }
        } catch (e) {
          console.error("Error:", e.message ?? e);
        }
        rl.prompt();
        return;
      }

      // SQL input (multi-line until ;)
      buffer += (buffer ? "\n" : "") + line;
      if (buffer.trim().endsWith(";")) {
        const sql = buffer.trim().replace(/;\s*$/, "");
        buffer = "";
        try {
          await execAndOutput(sql);
        } catch (e) {
          console.error("Query error:", e.message ?? e);
        }
        rl.prompt();
      } else {
        rl.setPrompt("   ...> ");
        rl.prompt();
        rl.setPrompt("duckdb> ");
      }
    });

    rl.on("close", async () => {
      try { await saveHistory(histFile, rl.history); } catch {}
      console.log("bye!");
      resolve();
    });
  });
}

async function loadHistory(file) {
  try {
    const txt = await fs.readFile(file, "utf8");
    const lines = txt.split("\n").filter(Boolean);
    return lines.reverse().slice(0, 500);
  } catch {
    return [];
  }
}
async function saveHistory(file, histArr) {
  const lines = [...(histArr || [])].reverse().join("\n") + "\n";
  await fs.writeFile(file, lines);
}

// ---------- main ----------
(async () => {
  try {
    if (openPatterns.length) await mount(openPatterns);

    // optional SQL from a file
    let sqlFromFile = null;
    if (args.file) {
      args.file = single(args.file);
      sqlFromFile = await readSqlFile(String(args.file));
    }
    const runSql = args.query ? String(args.query) : sqlFromFile;

    if (runSql) {
      await execAndOutput(runSql, args.out);

      // optional one-shot chart
      if (args.chart) {
        let type = String(single(args.chart)).toLowerCase();
        let xcol = sanitizeColFlag(single(args.x) ?? "auto");
        let ycol = sanitizeColFlag(single(args.y) ?? "auto");
        if (type === "auto") type = "bar";
        if (!["bar","line","scatter"].includes(type)) {
          throw new Error("Invalid --chart type. Use bar|line|scatter|auto");
        }
        await chartFromLast(type, xcol, ycol, String(args.chartOut || "out/chart.html"));
      }
    } else {
      await startRepl();
    }
  } catch (e) {
    console.error("Error:", e.message ?? e);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
