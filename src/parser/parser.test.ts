import { tokenize } from '../lexer/tokenizer';
import { parse } from './parser';

const tokens = tokenize("SELECT department, AVG(salary), COUNT(*) FROM employees.csv WHERE age > 27 GROUP BY department");
const ast = parse(tokens);
console.log(ast);