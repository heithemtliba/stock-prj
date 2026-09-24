const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Supprimer le bloc mal place (avec le commentaire)
const malPlace = `      // Noms articles depuis table articles
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

// Bon endroit : juste avant "const rapport = {"
const bonEndroit = `const rapport = {`;

s = s.split(malPlace).join('');
s = s.replace(bonEndroit, malPlace + bonEndroit);

// Correction : les deux occurrences
const count = (s.match(/const codesUniques/g)||[]).length;
console.log('Occurrences codesUniques:', count);
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK lignes:', s.split('\n').length);
