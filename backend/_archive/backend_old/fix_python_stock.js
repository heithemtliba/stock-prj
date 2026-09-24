const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

// Remplacer la fonction get_stock_article pour lire depuis le JSON
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('def get_stock_article(code_article):')) {
    console.log('Trouve ligne', i+1);
    lines[i]   = 'def get_stock_article(code_article):';
    lines[i+1] = '    return {}  # Stock pre-calcule cote Node';
    break;
  }
}

// Ajouter lecture stockParArticle depuis data
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("inactifs    = filtrer_articles")) {
    console.log('Insertion stockParArticle ligne', i+2);
    lines.splice(i+1, 0, "stock_par_article = data.get('stockParArticle', {})  # Stock temps reel pre-calcule");
    break;
  }
}

// Remplacer get_stock_article(code) par lecture directe du dict
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('stock_reel = get_stock_article(code)')) {
    lines[i] = lines[i].replace('stock_reel = get_stock_article(code)', 'stock_reel = stock_par_article.get(str(code), {})');
    console.log('Remplace ligne', i+1);
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
