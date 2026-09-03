import { tokenize } from '../lexer/tokenizer';
import { parse } from './parser';

const tokens = tokenize("SELECT name FROM employees.csv WHERE age >= 27");
const ast = parse(tokens);
console.log(ast);