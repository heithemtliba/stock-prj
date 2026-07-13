const XLSX = require('xlsx');

const files = [
  '../data/listes/Liste_2_E26.xlsx',
  '../data/listes/Liste_3_bis_E26.xlsx',
  '../data/listes/Liste_3_E26_1.xlsx',
  '../data/listes/Liste_4_E26.xlsx'
];

for (const f of files) {
  const wb = XLSX.readFile(f);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log('\n=== ' + f.split('/').pop() + ' ===');
  console.log('Header row 1:', rows[0]);
  console.log('Header row 2:', rows[1]);
  console.log('Data row 3:', rows[2]);
  console.log('Total rows:', rows.length);
}
