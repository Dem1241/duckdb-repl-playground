// src/lib/db.mjs
import duckdb from "duckdb";

export function openDb(filename = ":memory:") {
  const db = new duckdb.Database(filename);
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

  const close = async () => {
    try { conn.close?.(); } catch {}
    try { db.close?.(); } catch {}
  };

  return { db, conn, run, all, close };
}
