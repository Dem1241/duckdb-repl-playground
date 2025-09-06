// src/check.mjs
import duckdb from "duckdb";

const db = new duckdb.Database(":memory:");
const conn = db.connect();


function run(sql, params) {
  return new Promise((resolve, reject) => {
    if (params && params.length) {
      conn.run(sql, params, err => (err ? reject(err) : resolve()));
    } else {
      conn.run(sql, err => (err ? reject(err) : resolve()));
    }
  });
}

function all(sql, params) {
  return new Promise((resolve, reject) => {
    if (params && params.length) {
      conn.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    } else {
      conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
    }
  });
}

try {
  await run("CREATE TABLE people (id INTEGER, name TEXT)");
  await run("INSERT INTO people VALUES (1,'Ish'), (2,'Ava'), (3,'Kai')");

  const rows = await all("SELECT * FROM people ORDER BY id");
  console.table(rows);
} catch (e) {
  console.error("DuckDB error:", e);
  process.exitCode = 1;
} finally {
  try { conn.close?.(); } catch {}
  try { db.close?.(); } catch {}
}
