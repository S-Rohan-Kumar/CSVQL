import * as fs from 'fs';
import * as path from 'path';

export function readCSV(filePath: string): Record<string, string>[] {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    const data = fs.readFileSync(resolvedPath, 'utf-8');
    const allLines = data.split(/\r?\n/);
    const lines = allLines.filter((line : string) => line.trim().length > 0);

    if (lines.length === 0) {
        return [];
    }

    const headers = lines[0].split(',');
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row: Record<string, string> = {};

        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = values[j] ?? '';
        }

        rows.push(row);
    }

    return rows;
}

