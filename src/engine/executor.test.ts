import { readCSV } from './csvReader';
import { tokenize } from '../lexer/tokenizer';
import { parse } from '../parser/parser';
import { execute } from './executor';

const rows = readCSV('./examples/employes.csv');
const tokens = tokenize('SELECT name FROM employees.csv WHERE department = Engineering');
const ast = parse(tokens);
const result = execute(ast, rows);

console.log(result);