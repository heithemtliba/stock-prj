require("dotenv").config();
const XLSX = require('xlsx');
const db = require("../../config/database");
const path = require('path');
const fs = require('fs');

db.exec(`CREATE TABLE IF NOT EXISTS distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_article TEXT NOT NULL,
  nom TEXT,
  store_id TEXT NOT NULL,
  date_envoi TEXT NOT NULL,
  liste TEXT,
  saison TEXT
)`);
db.exec(`DELETE FROM distributions`);

const STORE_MAP = {
  '014 : CARREFOUR': '014', '021 : TUNISIA MALL': '021',
  '024 : GEANT 3': '024', '002 : MENZAH': '002',
  '009 : SFAX A': '009', '016 : LAFAYETTE': '016',
  '029 : Sousse Slim Centre': '029', 'ZEPHYR': '015',
  'JAMEL ABDENNACEUR': '005', 'NABEUL': '011',
  'AZUR CITY': '030', 'SOUKRA': '031',
  'E-COMMERCE': '019', 'MALL OF SFAX': '032', 'Lac Premium': '033'
};

function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null;
  return new Date((serial - 25569) * 86400 * 1000).toISOString().split('T')[0];
}

const insert = db.prepare(`INSERT INTO distributions (code_article, nom, store_id, date_envoi, liste, saison) VALUES (?,?,?,?,?,?)`);

const files = fs.readdirSync('../data/listes/').filter(f => f.endsWith('.xlsx'));
let total = 0;

db.transaction(() => {
  for (const file of files) {
    const rows = XLSX.utils.sheet_to_json(
      XLSX.readFile(path.join('../data/listes/', file)).Sheets[
        XLSX.readFile(path.join('../data/listes/', file)).SheetNames[0]
      ], { header: 1 }
    );
    const headers = rows[1];
    const idxDate  = headers.findIndex(h => String(h).trim() === 'date liste');
    const idxNom   = headers.findIndex(h => String(h).trim() === 'Nom');
    const idxListe = headers.findIndex(h => String(h).trim() === 'Liste');
    const idxSaison= headers.findIndex(h => String(h).trim() === 'Saison');
    
    // Reference est toujours a index 8 (confirme)
    let count = 0;
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const code = String(row[8] || '').trim();
      if (!code || isNaN(Number(code))) continue;
      const dateEnvoi = excelDateToISO(row[idxDate]);
      if (!dateEnvoi) continue;
      for (const [col, storeId] of Object.entries(STORE_MAP)) {
        const idx = headers.findIndex(h => String(h).trim() === col.trim());
        if (idx > -1 && (row[idx] === 'X' || row[idx] === 'x')) {
          insert.run(code, String(row[idxNom]||''), storeId, dateEnvoi, String(row[idxListe]||''), String(row[idxSaison]||''));
          total++; count++;
        }
      }
    }
    console.log(file, '->', count, 'lignes');
  }
})();

console.log('Total:', total);
const sample = db.prepare(`SELECT code_article, store_id, date_envoi, CAST(julianday('now')-julianday(date_envoi) AS INTEGER) as jours FROM distributions LIMIT 5`).all();
sample.forEach(r => console.log(r));
