import {
    SelectQuery,
    Condition,
    AggregateCall,
    ColumnSelection,
} from "../parser/parser";

function matchLike(text: string, pattern: string): boolean {
    if (text === null || text === undefined) return false;
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
    return new RegExp(`^${escaped}$`, "i").test(text);
}

function evaluateCondition(
    row: Record<string, string>,
    condition: Condition,
): boolean {
    if (condition.type === "SimpleCondition") {
        const rowVal = row[condition.column];
        const targetVal = condition.value;
        const op = condition.operator;

        if (op === "LIKE") {
            return matchLike(rowVal, targetVal);
        }

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
    } else if (condition.type === "ComplexCondition") {
        const leftResult = evaluateCondition(row, condition.left);
        const rightResult = evaluateCondition(row, condition.right);

        if (condition.operator === "AND") {
            return leftResult && rightResult;
        } else if (condition.operator === "OR") {
            return leftResult || rightResult;
        }
    }

    return false;
}

function calculateAggregate(
    fn: "COUNT" | "SUM" | "AVG",
    column: string,
    groupRows: Record<string, string>[],
): string {
    if (fn === "COUNT") {
        return String(groupRows.length);
    }

    if (fn === "SUM" || fn === "AVG") {
        let sum = 0;
        for (let i = 0; i < groupRows.length; i++) {
            sum += Number(groupRows[i][column] || 0);
        }

        if (fn === "SUM") {
            return String(sum);
        }

        if (fn === "AVG") {
            const avg = groupRows.length > 0 ? sum / groupRows.length : 0;
            return String(Number(avg.toFixed(2)));
        }
    }

    return "";
}

export function execute(
    query: SelectQuery,
    rows: Record<string, string>[],
): Record<string, string>[] {
    const filteredRows: Record<string, string>[] = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (query.where && !evaluateCondition(row, query.where)) {
            continue;
        }
        filteredRows.push(row);
    }

    const hasAggregates = query.columns.some((col) => typeof col !== "string");
    const hasGroupBy = query.groupBy && query.groupBy.length > 0;

    if (hasGroupBy || hasAggregates) {
        const groups = new Map<string, Record<string, string>[]>();

        if (hasGroupBy && query.groupBy) {
            const groupCol = query.groupBy[0];
            for (let i = 0; i < filteredRows.length; i++) {
                const row = filteredRows[i];
                const key = row[groupCol] || "";
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key)!.push(row);
            }
        } else {
            groups.set("ALL", filteredRows);
        }

        const result: Record<string, string>[] = [];

        groups.forEach((groupRows) => {
            if (groupRows.length === 0) return;

            const resultRow: Record<string, string> = {};

            for (let i = 0; i < query.columns.length; i++) {
                const col = query.columns[i];

                if (typeof col === "string") {
                    resultRow[col] = groupRows[0][col];
                } else {
                    const aggregateCall = col as AggregateCall;
                    const colLabel = `${aggregateCall.fn}(${aggregateCall.column})`;
                    resultRow[colLabel] = calculateAggregate(
                        aggregateCall.fn,
                        aggregateCall.column,
                        groupRows,
                    );
                }
            }

            result.push(resultRow);
        });

        return result;
    }

    const result: Record<string, string>[] = [];
    const isSelectAll = query.columns.length === 1 && query.columns[0] === "*";

    for (let i = 0; i < filteredRows.length; i++) {
        const row = filteredRows[i];

        if (isSelectAll) {
            result.push({ ...row });
        } else {
            const newRow: Record<string, string> = {};
            for (let j = 0; j < query.columns.length; j++) {
                const col = query.columns[j] as string;
                newRow[col] = row[col];
            }
            result.push(newRow);
        }
    }

    return result;
}
