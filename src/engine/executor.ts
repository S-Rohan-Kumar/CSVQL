import {
    SelectQuery,
    Condition,
    AggregateCall,
    ColumnSelection,
    RegularColumn,
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

        if (op === "IN" && Array.isArray(targetVal)) {
            return targetVal.includes(rowVal);
        }

        if (op === "NOT IN" && Array.isArray(targetVal)) {
            return !targetVal.includes(rowVal);
        }

        if (op === "LIKE" && typeof targetVal === "string") {
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
    const sourceRows =
        typeof query.from === "string" ? rows : execute(query.from, rows);

    const filteredRows: Record<string, string>[] = [];
    for (let i = 0; i < sourceRows.length; i++) {
        const row = sourceRows[i];
        if (query.where && !evaluateCondition(row, query.where)) {
            continue;
        }
        filteredRows.push(row);
    }

    const hasAggregates = query.columns.some(
        (col) => col.type === "AggregateCall",
    );
    const hasGroupBy = query.groupBy && query.groupBy.length > 0;

    let result: Record<string, string>[] = [];

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

        groups.forEach((groupRows) => {
            if (groupRows.length === 0) return;

            const evalContext: Record<string, string> = { ...groupRows[0] };

            query.columns.forEach((col) => {
                if (col.type === "AggregateCall") {
                    const defaultLabel = `${col.fn}(${col.column})`;
                    const computedVal = calculateAggregate(
                        col.fn,
                        col.column,
                        groupRows,
                    );
                    evalContext[defaultLabel] = computedVal;
                    if (col.alias) {
                        evalContext[col.alias] = computedVal;
                    }
                }
            });

            if (query.having) {
                const ensureHavingColumn = (cond: Condition) => {
                    if (cond.type === "SimpleCondition") {
                        if (evalContext[cond.column] === undefined) {
                            const match = cond.column.match(
                                /^(COUNT|SUM|AVG)\((.*)\)$/,
                            );
                            if (match) {
                                const fn = match[1] as "COUNT" | "SUM" | "AVG";
                                const arg = match[2];
                                evalContext[cond.column] = calculateAggregate(
                                    fn,
                                    arg,
                                    groupRows,
                                );
                            }
                        }
                    } else if (cond.type === "ComplexCondition") {
                        ensureHavingColumn(cond.left);
                        ensureHavingColumn(cond.right);
                    }
                };

                ensureHavingColumn(query.having);

                if (!evaluateCondition(evalContext, query.having)) {
                    return;
                }
            }

            const resultRow: Record<string, string> = {};

            for (let i = 0; i < query.columns.length; i++) {
                const col = query.columns[i];

                if (col.type === "Column") {
                    const targetKey = col.alias || col.name;
                    resultRow[targetKey] = groupRows[0][col.name];
                } else {
                    const defaultLabel = `${col.fn}(${col.column})`;
                    const targetKey = col.alias || defaultLabel;
                    resultRow[targetKey] = evalContext[defaultLabel];
                }
            }

            result.push(resultRow);
        });
    } else {
        const isSelectAll =
            query.columns.length === 1 &&
            query.columns[0].type === "Column" &&
            query.columns[0].name === "*";

        for (let i = 0; i < filteredRows.length; i++) {
            const row = filteredRows[i];

            if (isSelectAll) {
                result.push({ ...row });
            } else {
                const newRow: Record<string, string> = {};
                for (let j = 0; j < query.columns.length; j++) {
                    const col = query.columns[j] as RegularColumn;
                    const targetKey = col.alias || col.name;
                    newRow[targetKey] = row[col.name];
                }
                result.push(newRow);
            }
        }
    }

    if (query.orderBy) {
        const { column, direction } = query.orderBy;
        result.sort((a, b) => {
            const valA = a[column] ?? "";
            const valB = b[column] ?? "";

            const numA = Number(valA);
            const numB = Number(valB);
            if (!isNaN(numA) && !isNaN(numB) && valA !== "" && valB !== "") {
                return direction === "ASC" ? numA - numB : numB - numA;
            }

            const cmp = valA.localeCompare(valB);
            return direction === "ASC" ? cmp : -cmp;
        });
    }

    return result;
}
