# duckDB playground (node + REPL + charts)

query CSV/Parquet (and soon JSON) with DuckDB from Node.js

## features
- REPL-first workflow: type SQL, see results instantly
- discoverability via `.help`, `.tables`, `.schema`, `.sample`
- mount files as views (`--open data/*.csv`)
- export results to CSV/JSON/Parquet (`.export out/file.ext`)
- quick charts (bar/line/scatter) to HTML (`.chart bar genre avg_rating out/genre.html`)
- one-shot mode if you need it (`-q` / `-f`) — optional

---

## quick start (REPL-first)

### install
```bash
npm install
````

### open the REPL with a dataset

```bash
npm run repl -- --open ./data/movies.csv
```

### get oriented

```text
.help             # list commands & examples
.tables           # what’s mounted?
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

-- export the last result
.export out/genre_avg.parquet
.export out/genre_avg.csv

-- chart the last result (x, y, output html)
.chart bar genre avg_rating out/genre_avg.html

.exit
```

> tip: you can mount more data anytime:
> `.open ./data/*.parquet` or `.open ./data/other.csv AS other_view`

---

## commands (what `.help` shows)

**meta**

* `.help` — show help
* `.exit` — quit

**data**

* `.tables` — list tables/views
* `.schema <name>` — show columns for a table/view
* `.open <fileOrGlob> [AS name]` — mount CSV/Parquet as a view
* `.drop <view>` — drop a view
* `.sample <view> [n]` — preview first *n* rows (default 5)

**results**

* `.export <path>` — export last result by extension
  (`.csv`, `.json`, `.parquet`)

**charts**

* `.chart <bar|line|scatter|auto> <xcol|auto> <ycol|auto> [out.html]`
  writes a self-contained Chart.js HTML file

---

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

---

