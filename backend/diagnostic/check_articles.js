// backend/diagnostic/check_articles.js
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

console.log('═══════════════════════════════════════');
console.log('  DIAGNOSTIC MABROUK STOCK');
console.log('═══════════════════════════════════════\n');

// 1. CSV — plusieurs chemins possibles
console.log('📄 FICHIER CSV:');
const cheminsPossibles = [
  path.join(__dirname, '..', 'data', 'articles_mabrouk.csv'),
  path.join(__dirname, '..', '..', 'data', 'articles_mabrouk.csv'),
  path.join(__dirname, '..', '..', '..', 'data', 'articles_mabrouk.csv'),
  path.join(process.cwd(), 'data', 'articles_mabrouk.csv'),
  path.join(process.cwd(), '..', 'data', 'articles_mabrouk.csv'),
];

let csvTrouve = null;
for (const p of cheminsPossibles) {
  if (fs.existsSync(p)) { csvTrouve = p; break; }
}

if (csvTrouve) {
  console.log('  ✓ Trouvé :', csvTrouve);
  const content = fs.readFileSync(csvTrouve, 'utf-8');
  const lines = content.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
  console.log(`  Nombre de lignes : ${lines.length}`);
  console.log('\n  En-tête :');
  console.log('   ', lines[0]);
  console.log('\n  Ligne 2 (premier article) :');
  console.log('   ', lines[1]);
  console.log('\n  Colonnes parsées :');
  lines[1].split(';').forEach((c, i) => {
    console.log(`    p[${i}] = "${c.trim()}"`);
  });
} else {
  console.log('  ❌ CSV introuvable. Chemins testés :');
  cheminsPossibles.forEach(p => console.log('     -', p));
}

// 2. Recherche ItemService dans le code
console.log('\n🔍 RECHERCHE ItemService/GetItemList dans le code:');
function searchInDir(dir, pattern) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.name === 'node_modules' || file.name === '.git' || file.name === 'diagnostic') continue;
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      searchInDir(fullPath, pattern);
    } else if (file.name.endsWith('.js')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (pattern.test(content)) {
          console.log(`  ✓ Trouvé dans : ${fullPath}`);
        }
      } catch (e) {}
    }
  }
}
searchInDir(path.join(__dirname, '..'), /ItemService|ItemCatalog|GetItemList/i);
console.log('  (recherche terminée)');

// 3. Échantillon ventes
console.log('\n🛒 ÉCHANTILLON ventes (3 lignes):');
try {
  const ventes = db.prepare("SELECT * FROM ventes LIMIT 3").all();
  console.table(ventes);
} catch (e) {
  console.log('  Erreur:', e.message);
}

// 4. Vérifier si des articles 26E existent
console.log('\n🆕 ARTICLES RÉCENTS (collection 26E):');
try {
  const recents = db.prepare("SELECT code_article, libelle, collection, prix_detail FROM articles WHERE collection = '26E' LIMIT 10").all();
  if (recents.length === 0) {
    console.log('  ⚠️ Aucun article 26E en base → confirme le problème du ticket');
  } else {
    console.table(recents);
    const total = db.prepare("SELECT COUNT(*) as n FROM articles WHERE collection = '26E'").get();
    console.log(`  Total articles 26E : ${total.n}`);
  }
} catch (e) {
  console.log('  Erreur:', e.message);
}

console.log('\n═══════════════════════════════════════');