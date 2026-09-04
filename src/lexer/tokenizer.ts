export type TokenType =
    | "KEYWORD"
    | "IDENTIFIER"
    | "COMMA"
    | "NUMBER"
    | "LPAREN"
    | "RPAREN"
    | "ASTERISK"
    | "STRING"
    | "OPERATOR"
    | "EOF";

export interface Token {
    type: TokenType;
    value: string;
}

function isIdentifierChar(char: string): boolean {
    return /[a-zA-Z0-9./\\_%-]/.test(char);
}

export function tokenize(input: string): Token[] {
    let pos = 0;
    const tokens: Token[] = [];

    while (pos < input.length) {
        const char = input[pos];

        if (/\s/.test(char)) {
            pos++;
            continue;
        }
        if (char === ",") {
            tokens.push({ type: "COMMA", value: "," });
            pos++;
            continue;
        }

        if (char === "(") {
            tokens.push({ type: "LPAREN", value: "(" });
            pos++;
            continue;
        }
        if (char === ")") {
            tokens.push({ type: "RPAREN", value: ")" });
            pos++;
            continue;
        }
        if (char === "*") {
            tokens.push({ type: "ASTERISK", value: "*" });
            pos++;
            continue;
        }

        if (char === "'" || char === '"') {
            const quoteChar = char;
            pos++;
            const start = pos;
            while (pos < input.length && input[pos] !== quoteChar) {
                pos++;
            }
            if (pos >= input.length) {
                throw new Error(
                    `Unterminated string starting at position ${start - 1}`,
                );
            }
            const word = input.slice(start, pos);
            pos++;
            tokens.push({ type: "STRING", value: word });
            continue;
        }

        if (/[0-9]/.test(char)) {
            const start = pos;
            while (pos < input.length && /[0-9]/.test(input[pos])) {
                pos++;
            }
            const word = input.slice(start, pos);
            tokens.push({ type: "NUMBER", value: word });
            continue;
        }

        if (char === ">" || char === "<" || char === "=" || char === "!") {
            let op = char;
            pos++;
            if (
                input[pos] === "=" &&
                (op === ">" || op === "<" || op === "!")
            ) {
                op += "=";
                pos++;
            } else if (op === "<" && input[pos] === ">") {
                op = "!=";
                pos++;
            }
            tokens.push({ type: "OPERATOR", value: op });
            continue;
        }

        if (/[a-zA-Z%]/.test(char)) {
            let start = pos;
            while (pos < input.length && isIdentifierChar(input[pos])) pos++;
            const word = input.slice(start, pos);
            const upperWord = word.toUpperCase();

            const isKeyword =
                upperWord === "SELECT" ||
                upperWord === "FROM" ||
                upperWord === "WHERE" ||
                upperWord === "AND" ||
                upperWord === "OR" ||
                upperWord === "NOT" ||
                upperWord === "IS" ||
                upperWord === "GROUP" ||
                upperWord === "BY" ||
                upperWord === "HAVING" ||
                upperWord === "ORDER" ||
                upperWord === "LIMIT" ||
                upperWord === "OFFSET" ||
                upperWord === "ASC" ||
                upperWord === "DESC" ||
                upperWord === "COUNT" ||
                upperWord === "SUM" ||
                upperWord === "AVG" ||
                upperWord === "LIKE" ||
                upperWord === "IN" ||
                upperWord === "AS";

            if (isKeyword) {
                tokens.push({ type: "KEYWORD", value: upperWord });
            } else {
                tokens.push({ type: "IDENTIFIER", value: word });
            }
            continue;
        }
        throw new Error(`Unexpected character '${char}' at position ${pos}`);
    }

    tokens.push({ type: "EOF", value: "" });
    return tokens;
}
