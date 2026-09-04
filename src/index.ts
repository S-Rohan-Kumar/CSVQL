import { tokenize } from "./lexer/tokenizer";
import { parse, SelectQuery } from "./parser/parser";
import { readDataFile } from "./engine/dataReader";
import { execute } from "./engine/executor";
import { formatTable } from "./output/tableFormatter";
function getRootSourceFile(from: string | SelectQuery): string {
    if (typeof from === "string") return from;
    return getRootSourceFile(from.from);
}

export function query(sql: string): Record<string, string>[] {
    const tokens = tokenize(sql);
    const ast = parse(tokens);
    const rootFile = getRootSourceFile(ast.from);
    const rows = readDataFile(rootFile);
    return execute(ast, rows);
}

export function queryFormatted(sql: string): string {
    const result = query(sql);
    return formatTable(result);
}

export { tokenize, parse, readDataFile, execute, formatTable };
