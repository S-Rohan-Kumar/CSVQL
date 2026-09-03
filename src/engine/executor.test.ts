import { readCSV } from './csvReader';
import { tokenize } from '../lexer/tokenizer';
import { parse } from '../parser/parser';
import { execute } from './executor';

const rows = readCSV('./examples/employes.csv');
const tokens = tokenize('SELECT name, age , salary , department FROM employees.csv');
const ast = parse(tokens);
const result = execute(ast, rows);

console.log(result);