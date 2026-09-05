import {
    SelectQuery,
    Condition,
    AggregateCall,
    ColumnSelection,
    RegularColumn,
    JoinClause,
} from "../parser/parser";
import { readDataFile } from "./dataReader";

function matchLike(text: string, pattern: string): boolean {
    if (text === null || text === undefined) return false;
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
    return new RegExp(`^${escaped}$`, "i").test(text);
}

function getFieldValue(row: Record<string, string>, colName: string): string {
    if (row[colName] !== undefined) return row[colName];
    const bare = colName.split(".").pop()!;
    if (row[bare] !== undefined) return row[bare];
    for (const key of Object.keys(row)) {
        if (key.endsWith(`.${colName}`) || key.endsWith(`.${bare}`)) {
            return row[key];
        }
    }
    return "";
}

function evaluateCondition(
    row: Record<string, string>,
    condition: Condition,
): boolean {
    if (condition.type === "SimpleCondition") {
        const rowVal = getFieldValue(row, condition.column);
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
            const val = getFieldValue(groupRows[i], column);
            sum += Number(val || 0);
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
    let sourceRows =
        typeof query.from === "string" ? rows : execute(query.from, rows);

    if (query.joins && query.joins.length > 0) {
        const fromTableName =
            typeof query.from === "string" ? query.from : "subquery";
        const fromBaseName =
            fromTableName
                .split("/")
                .pop()
                ?.replace(/\.(csv|json)$/i, "") || fromTableName;
        const leftPrefixes = [
            query.fromAlias,
            fromBaseName,
            fromTableName,
        ].filter(Boolean) as string[];

        let currentRows: Record<string, string>[] = sourceRows.map((row) => {
            const enriched: Record<string, string> = { ...row };
            for (const key of Object.keys(row)) {
                for (const prefix of leftPrefixes) {
                    enriched[`${prefix}.${key}`] = row[key];
                }
            }
            return enriched;
        });

        for (const join of query.joins) {
            const rightRowsRaw = readDataFile(join.table);
            const joinBaseName =
                join.table
                    .split("/")
                    .pop()
                    ?.replace(/\.(csv|json)$/i, "") || join.table;
            const rightPrefixes = [join.alias, joinBaseName, join.table].filter(
                Boolean,
            ) as string[];

            const rightRowsEnriched = rightRowsRaw.map((row) => {
                const enriched: Record<string, string> = { ...row };
                for (const key of Object.keys(row)) {
                    for (const prefix of rightPrefixes) {
                        enriched[`${prefix}.${key}`] = row[key];
                    }
                }
                return enriched;
            });

            let leftColSpec = join.on.leftColumn;
            let rightColSpec = join.on.rightColumn;
            if (
                rightRowsEnriched.length > 0 &&
                currentRows.length > 0 &&
                getFieldValue(rightRowsEnriched[0], leftColSpec) !== "" &&
                getFieldValue(currentRows[0], rightColSpec) !== "" &&
                getFieldValue(currentRows[0], leftColSpec) === ""
            ) {
                const tmp = leftColSpec;
                leftColSpec = rightColSpec;
                rightColSpec = tmp;
            }

            const map = new Map<string, Record<string, string>[]>();
            for (const rRow of rightRowsEnriched) {
                const val = getFieldValue(rRow, rightColSpec);
                if (!map.has(val)) {
                    map.set(val, []);
                }
                map.get(val)!.push(rRow);
            }

            const nextRows: Record<string, string>[] = [];
            for (const lRow of currentRows) {
                const lVal = getFieldValue(lRow, leftColSpec);
                const matches = map.get(lVal);

                if (matches && matches.length > 0) {
                    for (const rRow of matches) {
                        nextRows.push({ ...rRow, ...lRow });
                    }
                } else if (join.type === "LEFT") {
                    const emptyRight: Record<string, string> = {};
                    if (rightRowsEnriched.length > 0) {
                        for (const k of Object.keys(rightRowsEnriched[0])) {
                            emptyRight[k] = "";
                        }
                    }
                    nextRows.push({ ...emptyRight, ...lRow });
                }
            }

            currentRows = nextRows;
        }

        sourceRows = currentRows;
    }

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
                const key = getFieldValue(row, groupCol);
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
                    resultRow[targetKey] = getFieldValue(
                        groupRows[0],
                        col.name,
                    );
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
                    newRow[targetKey] = getFieldValue(row, col.name);
                }
                result.push(newRow);
            }
        }
    }

    if (query.orderBy) {
        const { column, direction } = query.orderBy;
        result.sort((a, b) => {
            const valA = getFieldValue(a, column);
            const valB = getFieldValue(b, column);

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
