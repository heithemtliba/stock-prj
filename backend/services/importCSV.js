const fs = require('fs');
const db = require('../config/database');

function convertirDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const s = dateStr.trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [jour, mois, annee] = s.split('/');
    return `${annee}-${mois}-${jour}`;
  }

  const mois = {
    'janv.': '01', 'fÃ©vr.': '02', 'mars': '03', 'avr.': '04',
    'mai': '05', 'juin': '06', 'juil.': '07', 'aoÃ»t': '08',
    'sept.': '09', 'oct.': '10', 'nov.': '11', 'dÃ©c.': '12',
    'janv': '01', 'fÃ©vr': '02', 'fÃ©v': '02', 'avr': '04',
    'juil': '07', 'sept': '09', 'oct': '10', 'nov': '11', 'dÃ©c': '12'
  };
  const parts = s.split(' ');
  if (parts.length === 2) {
    const moisNum = mois[parts[0].toLowerCase()];
    if (moisNum) return `${parts[1]}-${moisNum}-01`;
  }
  return null;
}

function importerCSV(filePath, dateDefaut = null) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const dataLines = lines.slice(1).filter(l => l.trim());
  const insert = db.prepare(`
    INSERT OR REPLACE INTO ventes
    (date_vente, store_id, code_article, reference_article, taille, couleur, saison, quantite, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cegid_csv')
  `);
  let imported = 0;
  let skipped = 0;
  const importAll = db.transaction(() => {
    for (const line of dataLines) {
      const parts = line.split(';');
      if (parts.length < 8) { skipped++; continue; }
      const date = parts[0].trim();
      const storeId = parts[1].trim();
      const codeArticle = parts[2].trim();
      const reference = parts[3].trim();
      const taille = parts[4].trim();
      const couleur = parts[5].trim();
      const saison = parts[6].trim();
      const quantiteRaw = parts[8] ? parts[8].trim() : parts[7].trim();
      const quantite = parseFloat(quantiteRaw.replace(',', '.'));
      if (isNaN(quantite) || quantite <= 0) { skipped++; continue; }
      if (!storeId || !reference) { skipped++; continue; }
      const dateSQL = convertirDate(date) || dateDefaut;
      if (!dateSQL) { skipped++; continue; }
      try {
        insert.run(dateSQL, storeId, codeArticle, reference, taille, couleur, saison, quantite);
        imported++;
      } catch (err) { skipped++; }
    }
  });
  importAll();
  return { imported, skipped, total: dataLines.length };
}

module.exports = { importerCSV };
