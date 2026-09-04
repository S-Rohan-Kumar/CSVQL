export function formatTable(rows: Record<string, string>[]): string {
    if (rows.length === 0) {
        return "No rows returned.";
    }

    const headers = Object.keys(rows[0]);
    const colWidths: Record<string, number> = {};

    for (const header of headers) {
        let maxLen = header.length;
        for (const row of rows) {
            const val = row[header] ?? "";
            if (val.length > maxLen) {
                maxLen = val.length;
            }
        }
        colWidths[header] = maxLen;
    }

    const headerLine = headers.map((h) => h.padEnd(colWidths[h])).join(" | ");

    const separatorLine = headers
        .map((h) => "-".repeat(colWidths[h]))
        .join("-|-");

    const dataLines = rows.map((row) => {
        return headers
            .map((h) => (row[h] ?? "").padEnd(colWidths[h]))
            .join(" | ");
    });

    return [headerLine, separatorLine, ...dataLines].join("\n");
}
