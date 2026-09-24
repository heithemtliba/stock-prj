// backend/diagnostic/check_csv_vs_db.js
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const csvPath = path.join(__dirname, '..', '..', 'data', 'articles_mabrouk.csv');
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.replace(/\r\n/g, '\n').split('\n').slice(1).filter(l => l.trim());

console.log(`Total lignes CSV : ${lines.length}\n`);

let stats = {
  p2_vide: 0,
  p2_rempli: 0,
  p1_vide: 0,
  ean_dans_ventes: 0,
  ean_pas_dans_ventes: 0,
  code_article_dans_articles: 0,
  code_article_pas_dans_articles: 0,
};

const sample = [];

for (let i = 0; i < Math.min(lines.length, 500); i++) {
  const p = lines[i].split(';');
  const p1 = (p[1] || '').trim();
  const p2 = (p[2] || '').trim();

  if (!p2) stats.p2_vide++; else stats.p2_rempli++;
  if (!p1) stats.p1_vide++;

  // Croisement sur EAN (p1) avec ventes.reference_article
  if (p1) {
    const found = db.prepare("SELECT code_article FROM ventes WHERE reference_article = ? LIMIT 1").get(p1);
    if (found) {
      stats.ean_dans_ventes++;
      if (sample.length < 5) sample.push({ ean: p1, code_article_ventes: found.code_article, p2_csv: p2, libelle: p[3] });
    } else {
      stats.ean_pas_dans_ventes++;
    }
  }

  // Croisement sur code_article (p2) avec table articles
  if (p2) {
    const found = db.prepare("SELECT code_article FROM articles WHERE code_article = ? LIMIT 1").get(p2);
    if (found) stats.code_article_dans_articles++;
    else stats.code_article_pas_dans_articles++;
  }
}

console.log('📊 STATS sur 500 lignes :');
console.log(`  p[2] (Code article) VIDE    : ${stats.p2_vide}`);
console.log(`  p[2] (Code article) REMPLI  : ${stats.p2_rempli}`);
console.log(`  p[1] (EAN) VIDE             : ${stats.p1_vide}`);
console.log(`  EAN trouvé dans ventes      : ${stats.ean_dans_ventes}`);
console.log(`  EAN NON trouvé dans ventes  : ${stats.ean_pas_dans_ventes}`);
console.log(`  code_article trouvé dans articles : ${stats.code_article_dans_articles}`);
console.log(`  code_article NON trouvé     : ${stats.code_article_pas_dans_articles}`);

if (sample.length) {
  console.log('\n🔍 Échantillon croisement EAN → code_article:');
  console.table(sample);
}

// Vérifier si les articles existent déjà via EAN
console.log('\n💡 INTERPRÉTATION :');
if (stats.p2_vide > 400) {
  console.log('  🚨 Le CSV a une colonne "Code article" (p[2]) quasi VIDE.');
  console.log('  → Le code du manager NE FONCTIONNERA PAS (tous les articles skippés).');
  console.log('  → Solution : soit réexporter le CSV en remplissant cette colonne,');
  console.log('    soit utiliser p[1] (EAN) comme clé d\'import.');
}
if (stats.ean_dans_ventes > 0) {
  console.log(`  ✅ ${stats.ean_dans_ventes} EANs sont croisables avec la table ventes.`);
  console.log('  → On peut importer en récupérant code_article via ventes.');
}