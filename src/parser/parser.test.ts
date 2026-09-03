import { tokenize } from '../lexer/tokenizer';
import { parse } from './parser';

const tokens = tokenize("SELECT name, department FROM employees.csv");
const ast = parse(tokens);
console.log(ast);