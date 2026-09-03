import { SelectQuery, Condition } from "../parser/parser";
import { readCSV } from "./csvReader";

function evaluateCondition(
    row: Record<string, string>,
    condition: Condition,
): boolean {
    let rowVal = row[condition.column];
    const targetVal = condition.value;
    const op = condition.operator;

    if (op === ">" || op === "<" || op === "<=" || op === ">=") {
        const numRow = Number(rowVal);
        const numTarget = Number(targetVal);
        if (op === ">") return numRow > numTarget;
        if (op === "<") return numRow < numTarget;
        if (op === "<=") return numRow <= numTarget;
        if (op === ">=") return numRow >= numTarget;
    } else if (op === "=" || op === "!=") {
        if (op === "=") return rowVal === targetVal;
        if (op === "!=") return rowVal !== targetVal;
    }
    return false;
}

export function execute(
    query: SelectQuery,
    rows: Record<string, string>[],
): Record<string, string>[] {
    const result: Record<string, string>[] = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (query.where && !evaluateCondition(row, query.where)) {
            continue;
        }
        const newRow: Record<string, string> = {};
        for (let j = 0; j < query.columns.length; j++) {
            const col = query.columns[j];
            newRow[col] = row[col];
        }
        result.push(newRow);
    }

    return result;
}
