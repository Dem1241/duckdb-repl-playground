// src/lib/db.mjs
import { DuckDBInstance } from "@duckdb/node-api";

export async function openDb(filename = ":memory:") {
  const instance = await DuckDBInstance.create(filename);
  const conn = await instance.connect();

  async function run(sql, params) {
    await conn.run(sql, params && params.length ? params : undefined);
  }

  async function all(sql, params) {
    const reader = await conn.runAndReadAll(sql, params && params.length ? params : undefined);
    return reader.getRowObjectsJS();
  }

  const close = async () => {
    try { conn.closeSync?.(); } catch {}
    try { instance.closeSync?.(); } catch {}
  };

  return { instance, conn, run, all, close };
}
