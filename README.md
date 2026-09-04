# csvql

⚡ A mini SQL query engine for CSV and JSON files — no database setup, no import step. Point it at a file and query it directly.

```bash
csvql "SELECT department, AVG(salary) FROM employees.csv WHERE age > 27 GROUP BY department"
```

```
department    | AVG(salary)
--------------|------------
Engineering   | 103333.33
Sales         | 80000
```

---

## Why csvql

Anyone who has a CSV or JSON file and wants to ask it a specific question — filter it, group it, aggregate it — usually has two options: open it in Excel, or spin up a real database just to answer one query. `csvql` skips both. It's a real query engine built from scratch: a tokenizer, a parser, and an execution engine that understands a practical subset of SQL and runs it directly against your file.

It's aimed at data analysts, backend and DevOps engineers digging through log exports, and anyone doing quick ad-hoc data exploration from the command line.

---

## Installation

```bash
npm install -g csvql
```

This installs the `csvql` command globally.

---

## Usage

```bash
csvql "<SQL query>"
```

The query string references your data file directly in the `FROM` clause — no import, no setup.

### Examples

**Filter and select specific columns**
```bash
csvql "SELECT name, salary FROM employees.csv WHERE salary > 90000"
```

**Group and aggregate**
```bash
csvql "SELECT department, AVG(salary), COUNT(*) FROM employees.csv WHERE age > 27 GROUP BY department"
```

**Query JSON just as easily as CSV**
```bash
csvql "SELECT name, department FROM employees.json WHERE age <= 30"
```

**Combine conditions**
```bash
csvql "SELECT name FROM employees.csv WHERE department = 'Engineering' AND age > 30"
```

---

## How it works

`csvql` is built as a real, small query engine — not a wrapper around string matching. Every query passes through four distinct stages:

1. **Tokenizer** — turns the raw query string into a stream of tokens (keywords, identifiers, operators, literals).
2. **Parser** — turns the token stream into an abstract syntax tree (AST) representing the query's structure: what to select, where to read from, how to filter, how to group.
3. **Planner** — lays out a fixed, predictable execution order: load data → filter (`WHERE`) → group (`GROUP BY`) → aggregate → project (`SELECT`).
4. **Executor** — runs that plan against the parsed rows and produces the final result.

This separation is deliberate. It keeps "understanding the query" and "running the query" as clean, independent concerns — the same design principle used in real database engines, scaled down to a learning-sized project.

---

## Supported SQL subset

| Clause | Support |
|---|---|
| `SELECT column, column, ...` | ✅ |
| `SELECT COUNT(...)`, `SUM(...)`, `AVG(...)` | ✅ |
| `SELECT COUNT(*)` | ✅ |
| `FROM file.csv` / `FROM file.json` | ✅ |
| `WHERE column = / > / < / >= / <= value` | ✅ |
| `WHERE ... AND ... OR ...` | ✅ |
| `GROUP BY column` | ✅ |
| Case-insensitive keywords | ✅ |
| Quoted string values (`'text'`, `"text"`) | ✅ |

`csvql` is a deliberate subset of SQL, not a full implementation. It's built to genuinely understand how a query engine works internally — parsing, planning, execution — the same spirit as building a distributed cache to understand Redis rather than to replace it. Tools like [`q`](https://harelba.github.io/q/) and [DuckDB](https://duckdb.org/) already solve this problem in production, and are the right choice for real workloads.

### Not yet supported

- **`HAVING`** — filtering on aggregated results after `GROUP BY`. *Coming soon.*
- Subqueries and JOINs across multiple files
- `ORDER BY` / `LIMIT`
- Full ANSI SQL compliance

These are scoped out intentionally rather than left unfinished — the goal of this project is a correct, well-tested subset rather than broad but shaky SQL coverage.

---

## Tech stack

- **Language:** TypeScript / Node.js
- **CLI:** [`commander`](https://www.npmjs.com/package/commander)
- **Testing:** Jest — unit tests for the tokenizer, parser, and executor stages independently

---

## Development

```bash
git clone https://github.com/<your-username>/csvql.git
cd csvql
npm install
npm run build
npm link
```

Run the test suite:
```bash
npm test
```

---

## License

MIT