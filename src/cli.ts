#!/usr/bin/env node

import { Command } from "commander";
import { queryFormatted } from "./index";

const program = new Command();

program
    .name("csvql")
    .description("⚡ A lightweight SQL query engine for CSV and JSON files")
    .version("2.1.0");

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
Supported SQL Syntax:
  SELECT      Specific columns, Wildcard (*), Aliases (col AS alias)
  FROM        CSV file (.csv), JSON file (.json), or Subqueries (SELECT ...)
  WHERE       Filters with AND / OR boolean logic
  OPERATORS   = , != , > , < , >= , <=
  PATTERN     LIKE 'prefix%' , LIKE '%suffix' , LIKE '%contains%'
  LIST MATCH  IN (val1, val2) , NOT IN (val1, val2)
  AGGREGATES  COUNT(*) , COUNT(col) , SUM(col) , AVG(col)
  GROUP BY    Group rows by column
  HAVING      Filter aggregated groups: HAVING COUNT(*) > 2
  ORDER BY    Sort rows: ORDER BY col ASC | DESC

Examples:
  $ csvql "SELECT * FROM classroom.csv WHERE Final_Grade = A"
  $ csvql "SELECT First_Name AS student, Final_Project AS score FROM classroom.csv WHERE Final_Grade IN (A, B) ORDER BY score DESC"
  $ csvql "SELECT department, AVG(salary), COUNT(*) FROM employees.csv WHERE age > 27 GROUP BY department HAVING COUNT(*) > 1"
  $ csvql "SELECT First_Name FROM (SELECT * FROM classroom.csv WHERE Final_Grade = A) WHERE Final_Project >= 94"
  $ csvql "SELECT * FROM employees.json WHERE name LIKE %son"
`
);

program.parse(process.argv);