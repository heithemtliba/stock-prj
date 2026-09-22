const XLSX = require('xlsx');
const wb = XLSX.readFile('../data/listes/Liste_2_E26.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log('Headers exacts:');
rows[1].forEach((h, i) => console.log(i, JSON.stringify(h)));
