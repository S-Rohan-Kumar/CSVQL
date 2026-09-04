import { Token, TokenType } from "../lexer/tokenizer";

export interface AggregateCall {
    type: "AggregateCall";
    fn: "COUNT" | "SUM" | "AVG";
    column: string;
}

export type ColumnSelection = string | AggregateCall;

export interface SelectQuery {
    type: "SelectQuery";
    columns: ColumnSelection[];
    from: string;
    where?: Condition;
    groupBy?: string[];
    having?: Condition;
}

export type Condition = SimpleCondition | ComplexCondition;

export interface SimpleCondition {
    type: "SimpleCondition";
    column: string;
    operator: string;
    value: string;
}

export interface ComplexCondition {
    type: "ComplexCondition";
    left: Condition;
    operator: "AND" | "OR";
    right: Condition;
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

    private check(type: TokenType, value?: string): boolean {
        const token = this.peek();
        if (!token) return false;
        if (token.type !== type) return false;
        if (value && token.value !== value) return false;
        return true;
    }

    parseSelectQuery(): SelectQuery {
        this.expect("KEYWORD", "SELECT");
        const columns: ColumnSelection[] = [];

        while (true) {
            const token = this.peek();

            if (this.check("ASTERISK")) {
                this.expect("ASTERISK");
                columns.push("*");
            } else if (
                token &&
                (token.value === "COUNT" ||
                    token.value === "SUM" ||
                    token.value === "AVG")
            ) {
                const fn = this.tokens[this.pos++].value as
                    | "COUNT"
                    | "SUM"
                    | "AVG";
                this.expect("LPAREN");

                let colName: string;
                if (this.check("ASTERISK")) {
                    colName = this.expect("ASTERISK")!.value;
                } else {
                    colName = this.expect("IDENTIFIER")!.value;
                }
                this.expect("RPAREN");

                columns.push({
                    type: "AggregateCall",
                    fn,
                    column: colName,
                });
            } else {
                const colToken = this.expect("IDENTIFIER");
                columns.push(colToken!.value);
            }

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
        if (this.check("KEYWORD", "WHERE")) {
            this.expect("KEYWORD", "WHERE");
            where = this.parseCondition();
        }

        let groupBy: string[] | undefined = undefined;
        if (this.check("KEYWORD", "GROUP")) {
            this.expect("KEYWORD", "GROUP");
            this.expect("KEYWORD", "BY");
            const groupCol = this.expect("IDENTIFIER")!.value;
            groupBy = [groupCol];
        }

        let having: Condition | undefined = undefined;
        if (this.check("KEYWORD", "HAVING")) {
            this.expect("KEYWORD", "HAVING");
            having = this.parseCondition();
        }

        this.expect("EOF");
        return { type: "SelectQuery", columns, from, where, groupBy };
    }

    private parseCondition(): Condition {
        let left: Condition = this.parseSimpleCondition();

        while (
            this.check("KEYWORD") &&
            (this.peek()?.value === "AND" || this.peek()?.value === "OR")
        ) {
            const opToken = this.tokens[this.pos++];
            const right = this.parseCondition();
            left = {
                type: "ComplexCondition",
                left,
                operator: opToken.value as "AND" | "OR",
                right,
            };
        }

        return left;
    }

    private parseSimpleCondition(): SimpleCondition {
        let column: string;
        const colPeek = this.peek();
        if (
            colPeek &&
            (colPeek.value === "COUNT" ||
                colPeek.value === "SUM" ||
                colPeek.value === "AVG")
        ) {
            const fn = this.tokens[this.pos++].value;
            this.expect("LPAREN");
            let arg: string;
            if (this.check("ASTERISK")) {
                arg = this.expect("ASTERISK")!.value;
            } else {
                arg = this.expect("IDENTIFIER")!.value;
            }
            this.expect("RPAREN");
            column = `${fn}(${arg})`;
        } else {
            const columnToken = this.expect("IDENTIFIER");
            column = columnToken!.value;
        }
        let operator: string;
        const opPeek = this.peek();
        if (opPeek && opPeek.type === "KEYWORD" && opPeek.value === "LIKE") {
            operator = this.tokens[this.pos++].value;
        } else {
            const operatorToken = this.expect("OPERATOR");
            operator = operatorToken!.value;
        }
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
            type: "SimpleCondition",
            column,
            operator,
            value: valueToken!.value,
        };
    }
}

export function parse(tokens: Token[]): SelectQuery {
    const parser = new Parser(tokens);
    return parser.parseSelectQuery();
}
