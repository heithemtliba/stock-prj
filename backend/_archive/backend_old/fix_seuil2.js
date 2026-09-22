const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('def seuil_transfert(id_receveur):')) {
    console.log('Trouve ligne', i+1);
    lines[i]   = "def seuil_transfert(id_donneur, id_receveur):";
    lines[i+1] = "    id_d = str(id_donneur); id_r = str(id_receveur)";
    lines[i+2] = "    if id_d in STORES_SUD or id_r in STORES_SUD:    return 8";
    lines[i+3] = "    if id_d in STORES_CENTRE or id_r in STORES_CENTRE: return 5";
    lines[i+4] = "    if id_d in STORES_NORD or id_r in STORES_NORD:   return 5";
    lines[i+5] = "    return 1";
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
