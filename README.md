# csvql

A lightweight SQL query engine for CSV and JSON files — no database setup, no import step. Point it at a file and query it directly.

```bash
csvql "SELECT d.dept_name, AVG(e.salary), COUNT(*) FROM employees.csv e JOIN departments.csv d ON e.dept_id = d.id GROUP BY d.dept_name ORDER BY AVG(e.salary) DESC"
```

```
d.dept_name | AVG(e.salary) | COUNT(*)
------------|---------------|---------
Marketing   | 110000        | 1
Engineering | 100000        | 2
Sales       | 76000         | 2
```

---

## Why csvql

Anyone who has a CSV or JSON file and wants to ask it a specific question — filter it, group it, aggregate it, sort it, even join it against a second file — usually has two options: open it in Excel, or spin up a real database just to answer one query. `csvql` skips both. It's a real query engine built from scratch: a tokenizer, a parser, and an execution engine that understands a practical subset of SQL and runs it directly against your files.

It's aimed at data analysts, backend and DevOps engineers digging through log exports, and anyone doing quick ad-hoc data exploration from the command line.

---

## Installation

```bash
npm install -g csvql-cli
```

This installs the `csvql` command globally.

---

## Usage

```bash
csvql "<SQL query>"
```

The query string references your data file(s) directly in the `FROM` clause — no import, no setup.

### Examples

**Wildcard and pattern matching**
```bash
csvql "SELECT * FROM classroom.csv WHERE First_Name LIKE 'A%'"
```

**Aliases, IN, and sorting**
```bash
csvql "SELECT First_Name AS student, Final_Project AS score FROM classroom.csv WHERE Final_Grade IN (A, B) ORDER BY score DESC"
```

**Group, aggregate, and filter the aggregated result**
```bash
csvql "SELECT department, AVG(salary), COUNT(*) FROM employees.csv WHERE age > 27 GROUP BY department HAVING COUNT(*) > 1"
```

**Subquery as a data source**
```bash
csvql "SELECT First_Name FROM (SELECT * FROM classroom.csv WHERE Final_Grade = A) WHERE Final_Project >= 94"
```

**Join two files, aggregate across them, and sort by the aggregate**
```bash
csvql "SELECT d.dept_name, AVG(e.salary), COUNT(*) FROM employees.csv e JOIN departments.csv d ON e.dept_id = d.id GROUP BY d.dept_name ORDER BY AVG(e.salary) DESC"
```

**Query JSON just as easily as CSV**
```bash
csvql "SELECT name, department FROM employees.json WHERE age <= 30"
```

---

## How it works

`csvql` is built as a real, small query engine — not a wrapper around string matching. Every query passes through four distinct stages:

1. **Tokenizer** — turns the raw query string into a stream of tokens (keywords, identifiers, operators, literals).
2. **Parser** — turns the token stream into an abstract syntax tree (AST) representing the query's structure: what to select, where to read from, how to join, how to filter, how to group, how to sort.
3. **Planner** — lays out a predictable execution order: load data (or execute a nested subquery, or join two data sources) → filter (`WHERE`) → group (`GROUP BY`) → aggregate → filter groups (`HAVING`) → sort (`ORDER BY`) → project (`SELECT`).
4. **Executor** — runs that plan against the parsed rows and produces the final result.

This separation is deliberate. It keeps "understanding the query" and "running the query" as clean, independent concerns — the same design principle used in real database engines, scaled down to a learning-sized project.

---

## Supported SQL subset

| Clause | Support |
|---|---|
| `SELECT column, column, ...` | Yes |
| `SELECT *` | Yes |
| `SELECT column AS alias` | Yes |
| `SELECT COUNT(...)`, `SUM(...)`, `AVG(...)` | Yes |
| `SELECT COUNT(*)` | Yes |
| `FROM file.csv` / `FROM file.json` | Yes |
| `FROM (subquery)` | Yes |
| `FROM file1 alias1 JOIN file2 alias2 ON alias1.col = alias2.col` | Yes |
| Qualified column references (`alias.column`) | Yes |
| `WHERE column = / != / > / < / >= / <= value` | Yes |
| `WHERE ... AND ... OR ...` | Yes |
| `WHERE column LIKE 'prefix%'` / `'%suffix'` / `'%contains%'` | Yes |
| `WHERE column IN (val1, val2, ...)` / `NOT IN (...)` | Yes |
| `GROUP BY column` | Yes |
| `HAVING` (filter on aggregated results, e.g. `HAVING COUNT(*) > 1`) | Yes |
| `ORDER BY column ASC / DESC` | Yes |
| `ORDER BY` on a raw aggregate expression (e.g. `ORDER BY AVG(salary) DESC`) | Yes |
| Case-insensitive keywords | Yes |
| Quoted string values (`'text'`, `"text"`) | Yes |

`csvql` is a deliberate subset of SQL, not a full implementation. It's built to genuinely understand how a query engine works internally — parsing, planning, execution — the same spirit as building a distributed cache to understand Redis rather than to replace it. Tools like [`q`](https://harelba.github.io/q/) and [DuckDB](https://duckdb.org/) already solve this problem in production, and are the right choice for real workloads.

### Not yet supported

- Joining more than two files in a single query
- Correlated subqueries or subqueries inside `WHERE` (only `FROM (subquery)` is currently supported)
- `LIMIT` / `OFFSET`
- Full ANSI SQL compliance

This project is under active development. The current release focuses on a correct, well-tested subset of SQL — broader coverage is planned and will be added in upcoming releases.

---

## Tech stack

- **Language:** TypeScript / Node.js
- **CLI:** [`commander`](https://www.npmjs.com/package/commander)
- **Testing:** Jest — unit tests for the tokenizer, parser, and executor stages independently

---

## Development

```bash
git clone https://github.com/S-Rohan-Kumar/csvql.git
cd csvql
npm install
npm run build
npm link
```

---

## License

MIT