// src/lib/export.mjs
import fs from "node:fs/promises";
import path from "node:path";

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function writeCSV(filePath, rows) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  if (!rows || rows.length === 0) {
    await fs.writeFile(filePath, "");
    return;
  }
  const cols = Object.keys(rows[0]);
  const lines = [];
  lines.push(cols.join(","));
  for (const r of rows) lines.push(cols.map(c => csvEscape(r[c])).join(","));
  await fs.writeFile(filePath, lines.join("\n"));
}

// BigInt-safe JSON replacer:
// - If a BigInt fits in Number safely, emit a Number.
// - Otherwise emit a string to avoid precision loss.
function jsonReplacer(_key, value) {
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  // Optional niceties:
  if (value instanceof Date) return value.toISOString();
  if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(value)) {
    return `0x${value.toString("hex")}`;
  }
  return value;
}

export async function writeJSON(filePath, rows) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(rows ?? [], jsonReplacer, 2));
}
