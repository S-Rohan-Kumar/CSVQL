import * as fs from 'fs';
import * as path from 'path';

export function readJSON(filePath: string): Record<string, string>[] {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    const rawData = fs.readFileSync(resolvedPath, 'utf-8');
    const parsedData = JSON.parse(rawData);

    if (!Array.isArray(parsedData)) {
        throw new Error(`JSON file at ${filePath} must contain an array of objects.`);
    }

    const rows: Record<string, string>[] = [];

    for (let i = 0; i < parsedData.length; i++) {
        const item = parsedData[i];
        const row: Record<string, string> = {};

        for (const key of Object.keys(item)) {
            row[key] = item[key] !== null && item[key] !== undefined ? String(item[key]) : '';
        }

        rows.push(row);
    }

    return rows;
}