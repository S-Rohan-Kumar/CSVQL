#!/usr/bin/env node

import { Command } from "commander";
import { queryFormatted } from "./index";

const program = new Command();

program
    .name("csvql")
    .description("⚡ A mini SQL query engine for CSV and JSON files")
    .version("1.0.0");

program
    .argument("<sql-query>", "SQL query to execute against CSV or JSON file")
    .action((sqlQuery: string) => {
        try {
            const output = queryFormatted(sqlQuery);
            console.log(output);
        } catch (err: any) {
            console.error(`❌ Error: ${err.message}`);
            process.exit(1);
        }
    });

program.addHelpText(
    "after",
    `
Examples:
  $ csvql "SELECT name, salary FROM employees.csv WHERE salary > 90000"
  $ csvql "SELECT department, AVG(salary), COUNT(*) FROM employees.csv WHERE age > 27 GROUP BY department"
  $ csvql "SELECT name, department FROM employees.json WHERE age <= 30"
`
);

program.parse(process.argv);