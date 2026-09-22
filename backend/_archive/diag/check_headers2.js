const XLSX = require('xlsx');
const files = [
  '../data/listes/Liste_3_bis_E26.xlsx',
  '../data/listes/Liste_3_E26_1.xlsx', 
  '../data/listes/Liste_4_E26.xlsx'
];
for (const f of files) {
  const wb = XLSX.readFile(f);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log('\n' + f.split('/').pop());
  rows[1].forEach((h, i) => console.log(i, JSON.stringify(h)));
  console.log('Row 3:', rows[2]);
}
