import { tokenize } from "./lexer/tokenizer";
import { parse } from "./parser/parser";
import { readDataFile } from "./engine/dataReader";
import { execute } from "./engine/executor";
import { formatTable } from "./output/tableFormatter";

export function query(sql: string): Record<string, string>[] {
    const tokens = tokenize(sql);
    const ast = parse(tokens);
    const rows = readDataFile(ast.from);
    return execute(ast, rows);
}

export function queryFormatted(sql: string): string {
    const result = query(sql);
    return formatTable(result);
}

export { tokenize, parse, readDataFile, execute, formatTable };