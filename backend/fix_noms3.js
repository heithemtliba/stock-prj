const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const bloc = `
      // Noms articles depuis table articles
      const codesUniques = [...new Set([
        ...donnees.critique.map(a => String(a.codeArticle)),
        ...donnees.faible.map(a => String(a.codeArticle)),
        ...articlesInactifs.map(a => String(a.code_article)),
        ...topArticles.map(a => String(a.code_article))
      ].filter(Boolean))];
      const nomsArticles = {};
      for (const code of codesUniques) {
        const art = db.prepare("SELECT libelle, famille FROM articles WHERE code_article = ?").get(code);
        nomsArticles[code] = art ? art.libelle + (art.famille ? ' - ' + art.famille : '') : '';
      }
`;

// Compter les "const rapport = {"
const nbRapport = (s.match(/const rapport = \{/g)||[]).length;
console.log('Occurrences "const rapport":', nbRapport);

// Remplacer toutes les occurrences
s = s.replace(/const rapport = \{/g, bloc + 'const rapport = {');

// Supprimer les doublons si deja present
const nbNoms = (s.match(/const codesUniques/g)||[]).length;
console.log('Occurrences codesUniques apres:', nbNoms);

fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
