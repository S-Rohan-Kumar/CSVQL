import { readCSV } from './csvReader';

const rows = readCSV('./examples/employes.csv');
console.log(rows);

