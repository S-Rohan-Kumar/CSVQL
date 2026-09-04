import { tokenize } from './tokenizer';

console.log(tokenize("SELECT name FROM employees.csv WHERE age >= 27 AND department = Engineering"));