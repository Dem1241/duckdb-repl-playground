// src/check.mjs
import { openDb } from "./lib/db.mjs";

const { run, all, close } = await openDb(":memory:");

try {
  await run("CREATE TABLE people (id INTEGER, name TEXT)");
  await run("INSERT INTO people VALUES (1,'Ish'), (2,'Ava'), (3,'Kai')");

  const rows = await all("SELECT * FROM people ORDER BY id");
  console.table(rows);
} catch (e) {
  console.error("DuckDB error:", e);
  process.exitCode = 1;
} finally {
  await close();
}
