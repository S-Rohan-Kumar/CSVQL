import { Token, TokenType } from "../lexer/tokenizer";

export interface AggregateCall {
    type: "AggregateCall";
    fn: "COUNT" | "SUM" | "AVG";
    column: string;
    alias?: string;
}

export interface RegularColumn {
    type: "Column";
    name: string;
    alias?: string;
}

export type ColumnSelection = RegularColumn | AggregateCall;

export interface OrderByClause {
    column: string;
    direction: "ASC" | "DESC";
}

export interface SelectQuery {
    type: "SelectQuery";
    columns: ColumnSelection[];
    from: string | SelectQuery;
    where?: Condition;
    groupBy?: string[];
    having?: Condition;
    orderBy?: OrderByClause;
}

export type Condition = SimpleCondition | ComplexCondition;

export interface SimpleCondition {
    type: "SimpleCondition";
    column: string;
    operator: string;
    value: string | string[];
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

    parseSelectQuery(isSubquery: boolean = false): SelectQuery {
        this.expect("KEYWORD", "SELECT");
        const columns: ColumnSelection[] = [];

        while (true) {
            const token = this.peek();

            if (this.check("ASTERISK")) {
                this.expect("ASTERISK");
                columns.push({ type: "Column", name: "*" });
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

                let alias: string | undefined = undefined;
                if (this.check("KEYWORD", "AS")) {
                    this.expect("KEYWORD", "AS");
                    alias = this.expect("IDENTIFIER")!.value;
                }

                columns.push({
                    type: "AggregateCall",
                    fn,
                    column: colName,
                    alias,
                });
            } else {
                const colToken = this.expect("IDENTIFIER");
                let alias: string | undefined = undefined;
                if (this.check("KEYWORD", "AS")) {
                    this.expect("KEYWORD", "AS");
                    alias = this.expect("IDENTIFIER")!.value;
                }
                columns.push({
                    type: "Column",
                    name: colToken!.value,
                    alias,
                });
            }

            if (this.check("COMMA")) {
                this.expect("COMMA");
            } else {
                break;
            }
        }

        this.expect("KEYWORD", "FROM");

        let from: string | SelectQuery;
        if (this.check("LPAREN")) {
            this.expect("LPAREN");
            from = this.parseSelectQuery(true);
            this.expect("RPAREN");
        } else {
            const fromToken = this.expect("IDENTIFIER");
            from = fromToken!.value;
        }

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

        let orderBy: OrderByClause | undefined = undefined;
        if (this.check("KEYWORD", "ORDER")) {
            this.expect("KEYWORD", "ORDER");
            this.expect("KEYWORD", "BY");

            let orderCol: string;
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
                orderCol = `${fn}(${arg})`;
            } else {
                orderCol = this.expect("IDENTIFIER")!.value;
            }

            let direction: "ASC" | "DESC" = "ASC";
            const dirPeek = this.peek();
            if (
                dirPeek &&
                dirPeek.type === "KEYWORD" &&
                (dirPeek.value === "ASC" || dirPeek.value === "DESC")
            ) {
                direction = this.tokens[this.pos++].value as "ASC" | "DESC";
            }

            orderBy = { column: orderCol, direction };
        }

        if (!isSubquery) {
            this.expect("EOF");
        }

        return {
            type: "SelectQuery",
            columns,
            from,
            where,
            groupBy,
            having,
            orderBy,
        };
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

        if (opPeek && opPeek.type === "KEYWORD" && opPeek.value === "NOT") {
            this.tokens[this.pos++]; // consume NOT
            this.expect("KEYWORD", "IN");
            operator = "NOT IN";
        } else if (
            opPeek &&
            opPeek.type === "KEYWORD" &&
            opPeek.value === "IN"
        ) {
            this.tokens[this.pos++];
            operator = "IN";
        } else if (
            opPeek &&
            opPeek.type === "KEYWORD" &&
            opPeek.value === "LIKE"
        ) {
            operator = this.tokens[this.pos++].value;
        } else {
            const operatorToken = this.expect("OPERATOR");
            operator = operatorToken!.value;
        }

        let value: string | string[];

        if (operator === "IN" || operator === "NOT IN") {
            this.expect("LPAREN");
            const values: string[] = [];
            while (true) {
                const token = this.peek();
                if (
                    !token ||
                    (token.type !== "NUMBER" &&
                        token.type !== "STRING" &&
                        token.type !== "IDENTIFIER")
                ) {
                    throw new Error(
                        `Unexpected token in IN clause: ${token?.value}`,
                    );
                }
                values.push(this.tokens[this.pos++].value);
                if (this.check("COMMA")) {
                    this.expect("COMMA");
                } else {
                    break;
                }
            }
            this.expect("RPAREN");
            value = values;
        } else {
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
            value = this.tokens[this.pos++].value;
        }

        return {
            type: "SimpleCondition",
            column,
            operator,
            value,
        };
    }
}

export function parse(tokens: Token[]): SelectQuery {
    const parser = new Parser(tokens);
    return parser.parseSelectQuery();
}
