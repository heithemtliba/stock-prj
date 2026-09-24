const fs = require('fs');
let s = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8');

// Remplacer le caractere problematique dans les bons de transfert
s = s.replace(/DE : \{donneur\}  \?  VERS/g, 'DE : {donneur}  ->  VERS');
s = s.replace(/TOTAL BON #\{bon_num:03d\} \u2014 \{donneur\}  \?  \{receveur\}/g, 
              'TOTAL BON #{bon_num:03d} -- {donneur} -> {receveur}');

// Trouver et afficher les lignes avec le probleme
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (l.includes('donneur') && (l.includes('?') || l.includes('->'))) {
    console.log('Ligne', i+1, ':', l.trim().substring(0, 80));
  }
});

fs.writeFileSync('../scripts/exportRapportHebdo.py', s, 'utf8');
console.log('OK');
