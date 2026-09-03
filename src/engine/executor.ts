import { SelectQuery } from "../parser/parser";
import { readCSV } from "./csvReader";

export function execute(
    query: SelectQuery,
    rows: Record<string, string>[],
): Record<string, string>[] {
    const result: Record<string, string>[] = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const newRow: Record<string, string> = {};

        for (let j = 0; j < query.columns.length; j++) {
            const col = query.columns[j];
            newRow[col] = row[col];
        }

        result.push(newRow);
    }

    return result;
}
