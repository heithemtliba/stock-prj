require("dotenv").config();
const XLSX = require('xlsx');
const db = require("./config/database");
const path = require('path');
const fs = require('fs');

// Creer table distributions
db.exec(`
  CREATE TABLE IF NOT EXISTS distributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_article TEXT NOT NULL,
    reference TEXT,
    nom TEXT,
    store_id TEXT NOT NULL,
    date_envoi TEXT NOT NULL,
    liste TEXT,
    saison TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_dist_article_store ON distributions(code_article, store_id)`);

// Map nom boutique -> store_id
const STORE_MAP = {
  '014 : CARREFOUR':        '014',
  '021 : TUNISIA MALL':     '021',
  '024 : GEANT 3':          '024',
  '002 : MENZAH':           '002',
  '009 : SFAX A':           '009',
  '016 : LAFAYETTE':        '016',
  '029 : Sousse Slim Centre': '029',
  'ZEPHYR':                 '015',
  'JAMEL ABDENNACEUR':      '005',
  'NABEUL':                 '011',
  'AZUR CITY':              '030',
  'SOUKRA':                 '031',
  'E-COMMERCE':             '019',
  'MALL OF SFAX':           '032',
  'Lac Premium':            '033'
};

// Convertir numero Excel en date
function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null;
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

const insert = db.prepare(`
  INSERT OR REPLACE INTO distributions (code_article, reference, nom, store_id, date_envoi, liste, saison)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const listesDir = '../data/listes/';
const files = fs.readdirSync(listesDir).filter(f => f.endsWith('.xlsx'));

let total = 0;
const importAll = db.transaction(() => {
  for (const file of files) {
    const wb = XLSX.readFile(path.join(listesDir, file));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = rows[1]; // ligne 2 = headers
    
    // Trouver indices colonnes importantes
    const idxRef      = headers.findIndex(h => h === 'Référence');
    const idxNom      = headers.findIndex(h => h === 'Nom');
    const idxDate     = headers.findIndex(h => h === 'date liste');
    const idxListe    = headers.findIndex(h => h === 'Liste');
    const idxSaison   = headers.findIndex(h => h === 'Saison');

    console.log(`\n${file}: ref=${idxRef} date=${idxDate} liste=${idxListe}`);

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const codeArticle = String(row[idxRef] || '').trim();
      if (!codeArticle || codeArticle === 'undefined') continue;

      const dateEnvoi = excelDateToISO(row[idxDate]);
      if (!dateEnvoi) continue;

      const nom    = String(row[idxNom] || '').trim();
      const liste  = String(row[idxListe] || '').trim();
      const saison = String(row[idxSaison] || '').trim();

      // Parcourir colonnes boutiques
      for (const [colName, storeId] of Object.entries(STORE_MAP)) {
        const idx = headers.findIndex(h => h === colName);
        if (idx === -1) continue;
        if (row[idx] === 'X' || row[idx] === 'x') {
          insert.run(codeArticle, null, nom, storeId, dateEnvoi, liste, saison);
          total++;
        }
      }
    }
    console.log(`  -> ${file} importe`);
  }
});

importAll();
console.log(`\nTotal distributions importees: ${total}`);

// Verification
const check = db.prepare(`
  SELECT code_article, store_id, date_envoi, 
         CAST(julianday('now') - julianday(date_envoi) AS INTEGER) as jours
  FROM distributions 
  WHERE code_article IN ('22403','22392','91543')
  ORDER BY code_article, store_id
`).all();
check.forEach(r => console.log(r));
