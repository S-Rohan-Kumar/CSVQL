export type TokenType =
    | "KEYWORD"
    | "IDENTIFIER"
    | "COMMA"
    | "NUMBER"
    | "OPERATOR"
    | "EOF";

export interface Token {
    type: TokenType;
    value: string;
}

function isIdentifierChar(char: string): boolean {
    return /[a-zA-Z0-9.]/.test(char);
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

        if (/[0-9]/.test(char)) {
            const start = pos;
            while (pos < input.length && /[0-9]/.test(input[pos])) {
                pos++;
            }
            const word = input.slice(start, pos);
            tokens.push({ type: "NUMBER", value: word });
            continue;
        }

        if (char === ">" || char === "<" || char === "=") {
            let op = char;
            pos++;
            if (input[pos] === "=" && (op === ">" || op === "<")) {
                op += "=";
                pos++;
            }
            tokens.push({ type: "OPERATOR", value: op });
            continue;
        }

        if (/[a-zA-Z]/.test(char)) {
            let start = pos;
            while (pos < input.length && isIdentifierChar(input[pos])) pos++;
            const word = input.slice(start, pos);
            if (word === "SELECT" || word === "FROM" || word === "WHERE") {
                tokens.push({ type: "KEYWORD", value: word });
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
