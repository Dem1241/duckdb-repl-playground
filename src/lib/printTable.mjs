// src/lib/printTable.mjs
export function printTable(rows, maxRows = 200) {
  if (!rows || rows.length === 0) {
    console.log("(0 rows)");
    return;
  }
  const view = rows.slice(0, maxRows);
  const cols = Object.keys(view[0]);
  const widths = cols.map(c => Math.max(c.length, ...view.map(r => String(r[c] ?? "").length)));
  const sep = "+" + widths.map(w => "-".repeat(w + 2)).join("+") + "+";
  const line = vals => "| " + vals.map((v,i) => String(v ?? "").padEnd(widths[i], " ")).join(" | ") + " |";

  console.log(sep);
  console.log(line(cols));
  console.log(sep);
  for (const r of view) console.log(line(cols.map(c => r[c])));
  console.log(sep);
  if (rows.length > maxRows) console.log(`(showing ${maxRows} of ${rows.length} rows)`);
}
