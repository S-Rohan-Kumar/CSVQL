import { Token, TokenType } from "../lexer/tokenizer";

export interface SelectQuery {
    type: "SelectQuery";
    columns: string[];
    from: string;
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
        while(true){
            const colToken = this.expect('IDENTIFIER');
            columns.push(colToken!.value);

            if (this.check('COMMA')) {
                this.expect('COMMA');
            } else {
                break;
            }
        }
        this.expect('KEYWORD', 'FROM');
        const fromToken = this.expect('IDENTIFIER');
        const from = fromToken!.value;
        this.expect('EOF');
        return { type: "SelectQuery", columns, from };
    }
}

export function parse(tokens: Token[]): SelectQuery {
  const parser = new Parser(tokens);
  return parser.parseSelectQuery();
}