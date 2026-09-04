import * as fs from "fs";
import * as path from "path";
import { readCSV } from "./csvReader";
import { readJSON } from "./jsonReader";

export function resolveFilePath(filePath: string): string {
    const directPath = path.resolve(process.cwd(), filePath);
    if (fs.existsSync(directPath)) {
        return directPath;
    }
    const examplePath = path.resolve(process.cwd(), "examples", filePath);
    if (fs.existsSync(examplePath)) {
        return examplePath;
    }
    return directPath;
}

export function readDataFile(filePath: string): Record<string, string>[] {
    const resolved = resolveFilePath(filePath);
    if (resolved.endsWith(".json")) {
        return readJSON(resolved);
    }
    return readCSV(resolved);
}
