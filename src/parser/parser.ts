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

export interface JoinClause {
    type: "INNER" | "LEFT";
    table: string;
    alias?: string;
    on: {
        leftColumn: string;
        operator: string;
        rightColumn: string;
    };
}

export interface SelectQuery {
    type: "SelectQuery";
    columns: ColumnSelection[];
    from: string | SelectQuery;
    fromAlias?: string;
    joins?: JoinClause[];
    where?: Condition;
    groupBy?: string[];
    having?: Condition;
    orderBy?: OrderByClause;
    limit?: number;
    offset?: number;
}

export type Condition = SimpleCondition | ComplexCondition;

export interface SimpleCondition {
    type: "SimpleCondition";
    column: string;
    operator: string;
    value: string | string[] | SelectQuery;
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

        let fromTokenVal: string | SelectQuery;
        if (this.check("LPAREN")) {
            this.expect("LPAREN");
            fromTokenVal = this.parseSelectQuery(true);
            this.expect("RPAREN");
        } else {
            const fromToken = this.expect("IDENTIFIER");
            fromTokenVal = fromToken!.value;
        }
        const from = fromTokenVal;

        let fromAlias: string | undefined = undefined;
        if (this.check("KEYWORD", "AS")) {
            this.expect("KEYWORD", "AS");
            fromAlias = this.expect("IDENTIFIER")!.value;
        } else if (
            this.peek() &&
            this.peek()!.type === "IDENTIFIER" &&
            this.peek()!.value !== "WHERE" &&
            this.peek()!.value !== "JOIN" &&
            this.peek()!.value !== "INNER" &&
            this.peek()!.value !== "LEFT" &&
            this.peek()!.value !== "GROUP" &&
            this.peek()!.value !== "ORDER" &&
            this.peek()!.value !== "LIMIT" &&
            this.peek()!.value !== "OFFSET" &&
            this.peek()!.value !== "HAVING"
        ) {
            fromAlias = this.expect("IDENTIFIER")!.value;
        }

        const joins: JoinClause[] = [];
        while (
            this.check("KEYWORD", "JOIN") ||
            this.check("KEYWORD", "INNER") ||
            this.check("KEYWORD", "LEFT")
        ) {
            let joinType: "INNER" | "LEFT" = "INNER";
            if (this.check("KEYWORD", "LEFT")) {
                this.expect("KEYWORD", "LEFT");
                if (this.check("KEYWORD", "JOIN")) {
                    this.expect("KEYWORD", "JOIN");
                }
                joinType = "LEFT";
            } else if (this.check("KEYWORD", "INNER")) {
                this.expect("KEYWORD", "INNER");
                this.expect("KEYWORD", "JOIN");
                joinType = "INNER";
            } else {
                this.expect("KEYWORD", "JOIN");
                joinType = "INNER";
            }

            const tableToken = this.expect("IDENTIFIER");
            const joinTable = tableToken!.value;

            let joinAlias: string | undefined = undefined;
            if (this.check("KEYWORD", "AS")) {
                this.expect("KEYWORD", "AS");
                joinAlias = this.expect("IDENTIFIER")!.value;
            } else if (
                this.peek() &&
                this.peek()!.type === "IDENTIFIER" &&
                this.peek()!.value !== "ON"
            ) {
                joinAlias = this.expect("IDENTIFIER")!.value;
            }

            this.expect("KEYWORD", "ON");
            const leftCol = this.expect("IDENTIFIER")!.value;
            const op = this.expect("OPERATOR")!.value;
            const rightCol = this.expect("IDENTIFIER")!.value;

            joins.push({
                type: joinType,
                table: joinTable,
                alias: joinAlias,
                on: {
                    leftColumn: leftCol,
                    operator: op,
                    rightColumn: rightCol,
                },
            });
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

        let limit: number | undefined = undefined;
        if (this.check("KEYWORD", "LIMIT")) {
            this.expect("KEYWORD", "LIMIT");
            limit = Number(this.expect("NUMBER")!.value);
        }

        let offset: number | undefined = undefined;
        if (this.check("KEYWORD", "OFFSET")) {
            this.expect("KEYWORD", "OFFSET");
            offset = Number(this.expect("NUMBER")!.value);
        }

        if (!isSubquery) {
            this.expect("EOF");
        }

        return {
            type: "SelectQuery",
            columns,
            from,
            fromAlias,
            joins: joins.length > 0 ? joins : undefined,
            where,
            groupBy,
            having,
            orderBy,
            limit,
            offset,
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
            this.tokens[this.pos++];
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

        let value: string | string[] | SelectQuery;

        if (operator === "IN" || operator === "NOT IN") {
            this.expect("LPAREN");
            const nextToken = this.peek();
            if (
                nextToken &&
                nextToken.type === "KEYWORD" &&
                nextToken.value === "SELECT"
            ) {
                const subQuery = this.parseSelectQuery(true);
                this.expect("RPAREN");
                value = subQuery;
            } else {
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
            }
        } else {
            if (this.check("LPAREN")) {
                const nextToken = this.tokens[this.pos + 1];
                if (
                    nextToken &&
                    nextToken.type === "KEYWORD" &&
                    nextToken.value === "SELECT"
                ) {
                    this.expect("LPAREN");
                    const subQuery = this.parseSelectQuery(true);
                    this.expect("RPAREN");
                    value = subQuery;
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
