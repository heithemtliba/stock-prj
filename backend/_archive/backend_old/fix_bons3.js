const fs = require('fs');

// Fix 1: remplacer fleche dans Python
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('?')) {
    lines[i] = lines[i].replace(/?/g, '->');
    console.log('Fleche corrigee ligne', i+1);
  }
}
fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');

// Fix 2: filtrer bons de transfert selon seuil dans server.js
let sv = fs.readFileSync('server.js', 'utf8');

const ZONES = {
  SUD: ['009','032'], CENTRE: ['029'], NORD: ['011'],
  GRAND_TUNIS: ['002','005','014','015','016','019','021','024','030','031','033']
};

// Ajouter filtre seuil dans le calcul bonsTransfert
sv = sv.replace(
  "if (lignes.length > 0) {\n              bonsTransfert.push({",
  `// Verifier seuil transport
              const seuilBon = (ZONES_SUD.includes(sug.deId) || ZONES_SUD.includes(sug.versId)) ? 8
                : (ZONES_CENTRE.includes(sug.deId) || ZONES_CENTRE.includes(sug.versId)) ? 5
                : (ZONES_NORD.includes(sug.deId) || ZONES_NORD.includes(sug.versId)) ? 5 : 1;
              const totalBon = lignes.reduce((s,l) => s + l.quantite, 0);
              if (totalBon < seuilBon) continue;
              if (lignes.length > 0) {\n              bonsTransfert.push({`
);

// Ajouter constantes zones
sv = sv.replace(
  'const ARTICLES_EXCLUS',
  `const ZONES_SUD     = ['009','032'];
const ZONES_CENTRE  = ['029'];
const ZONES_NORD    = ['011'];
const ARTICLES_EXCLUS`
);

fs.writeFileSync('server.js', sv, 'utf8');
console.log('OK');
