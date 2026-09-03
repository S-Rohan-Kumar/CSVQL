import { Token, TokenType } from "../lexer/tokenizer";

export interface SelectQuery {
    type: "SelectQuery";
    columns: string[];
    from: string;
    where?: Condition;
}

export interface Condition {
    column: string;
    operator: string;
    value: string;
}

class Parser {
    private tokens: Token[];
    private pos: number;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.pos = 0;
    }

    private peek(): Token | null {
        if (this.pos < this.tokens.length) {
            return this.tokens[this.pos];
        }
        return null;
    }

    private expect(type: TokenType, value?: string): Token | null {
        const token = this.peek();
        if (token && token.type !== type)
            throw new Error(`Unexpected token ${token.type} ${token.value}`);
        if (token && value && token.value !== value)
            throw new Error(`Unexpected token ${token.type} ${token.value}`);
        return this.tokens[this.pos++];
    }

    private check(type: TokenType): boolean {
        return this.peek()?.type === type;
    }

    parseSelectQuery(): SelectQuery {
        this.expect("KEYWORD", "SELECT");
        const columns: string[] = [];
        while (true) {
            const colToken = this.expect("IDENTIFIER");
            columns.push(colToken!.value);

            if (this.check("COMMA")) {
                this.expect("COMMA");
            } else {
                break;
            }
        }
        this.expect("KEYWORD", "FROM");
        const fromToken = this.expect("IDENTIFIER");
        const from = fromToken!.value;

        let where: Condition | undefined = undefined;
        if (this.check("KEYWORD") && this.peek()?.value === "WHERE") {
            this.expect("KEYWORD", "WHERE");
            where = this.parseCondition();
        }

        this.expect("EOF");
        return { type: "SelectQuery", columns, from, where };
    }

    private parseCondition(): Condition {
        const columnToken = this.expect("IDENTIFIER");
        const operatorToken = this.expect("OPERATOR");
        const token = this.peek();
        if (!token) {
            throw new Error("Unexpected end of input in condition");
        }
        if (
            token.type !== "NUMBER" &&
            token.type !== "STRING" &&
            token.type !== "IDENTIFIER"
        ) {
            throw new Error(
                `Unexpected token ${token.type} ${token.value} for condition value`,
            );
        }
        const valueToken = this.tokens[this.pos++];
        return {
            column: columnToken!.value,
            operator: operatorToken!.value,
            value: valueToken!.value,
        };
    }
}

export function parse(tokens: Token[]): SelectQuery {
    const parser = new Parser(tokens);
    return parser.parseSelectQuery();
}
