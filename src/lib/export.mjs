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

export async function writeJSON(filePath, rows) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(rows ?? [], null, 2));
}
