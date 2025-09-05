# duckDB playground (node + REPL + charts)

query CSV/Parquet (and soon JSON) with DuckDB from Node.js — explore, export, and visualize without standing up a server.

## features

* **REPL-first workflow**: type SQL, see results instantly
* **discoverability**: `.help`, `.tables`, `.schema`, `.sample`
* **mount files as views**: `--open data/*.csv` or `--open data/*.parquet`
* **globs** supported (Parquet globs are scanned natively)
* **exports**: CSV / JSON / Parquet (`.export out/file.ext` or `-o`)
* **quick charts**: bar/line/scatter to standalone HTML via Chart.js
* **one-shot mode**: `-q` or `-f queries/*.sql` (optionally export + chart)
* **:memory: or file-backed DB**: `--db :memory:` (default) or `--db file.duckdb`
* **robust charting**: case-insensitive columns, numeric coercion (incl. “8,35”), `--chart auto` / `.chart auto`


## quick start (REPL-first)

### install

```bash
npm install
```

### open the REPL with a dataset

```bash
npm run repl -- --open ./data/movies.csv
```

### get oriented

```text
.help             # list commands & examples
.tables           # what’s mounted (views/tables)?
.schema movies    # columns & types
.sample movies 5  # quick peek
```

### run queries, export, chart

```sql
-- aggregate
SELECT genre, ROUND(AVG(rating), 2) AS avg_rating
FROM movies
GROUP BY 1
ORDER BY 2 DESC;

-- export the last result (extension decides format)
.export out/genre_avg.parquet
.export out/genre_avg.csv

-- chart the last result (type, x, y, output html)
.chart bar genre avg_rating out/genre_avg.html

.exit
```

> tip: mount more data anytime:
> `.open ./data/*.parquet` or `.open ./data/other.csv AS other_view`


## one-shot (optional)

### run a quick query and exit

```bash
node src/cli.mjs --open ./data/movies.csv \
  -q "SELECT * FROM movies LIMIT 5"
```

### full pipeline: query → export → chart

```bash
node src/cli.mjs --open ./data/movies.csv \
  -f queries/genre_avg.sql \
  -o out/genre_avg.parquet \
  -c bar --x genre --y avg_rating --chart-out out/genre_avg.html
```

### lazy charts (auto-pick columns)

```bash
node src/cli.mjs --open ./data/movies.csv \
  -f queries/genre_avg.sql \
  -c auto --chart-out out/genre_avg_auto.html
```


## commands (what `.help` shows)

**meta**

* `.help` -> show help
* `.exit` -> quit

**data**

* `.tables` -> list tables/views
* `.schema <name>` -> show columns for a table/view
* `.open <fileOrGlob> [AS name]` -> mount CSV/Parquet as a **view**
* `.drop <view>` -> drop a view
* `.sample <view> [n]` -> preview first *n* rows (default 5)

**results**

* `.export <path>` — export last result by extension
  supports `.csv`, `.json`, `.parquet`
  (Parquet export uses DuckDB `COPY (...)` for fidelity)

**charts**

* `.chart <bar|line|scatter|auto> <xcol|auto> <ycol|auto> [out.html]`
  writes a self-contained Chart.js HTML file


## CLI flags (reference)

```
--open <fileOrGlob>        CSV/Parquet files to mount as views (repeatable)
-q,  --query "<SQL>"       Run a query and exit
-f,  --file <path.sql>     Read SQL from a file
-o,  --out <out.ext>       Export result to .csv/.json/.parquet
-c,  --chart <type|auto>   Create chart: bar | line | scatter | auto
--x <col|auto>             X column for chart (or 'auto')
--y <col|auto>             Y column for chart (or 'auto')
--chart-out <path.html>    Chart HTML output (default: out/chart.html)
-d,  --db <path|:memory:>  DuckDB database (default :memory:)
--repl                     Force REPL (default if no -q/-f)
-h,  --help                Help
```

notes:

* you can pass `--open` multiple times (globs OK).
* when using a file-backed DB (`--db file.duckdb`), views and tables persist.

## license

MIT — do what you want, just don’t sue.
