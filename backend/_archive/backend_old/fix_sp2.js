const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('for (const { reference_article } of refs)')) {
    console.log('Trouve ligne', i+1);
    // Trouver la fin du bloc for (accolade fermante)
    let end = i + 1;
    let depth = 1;
    while (end < lines.length && depth > 0) {
      if (lines[end].includes('{')) depth++;
      if (lines[end].includes('}')) depth--;
      end++;
    }
    console.log('Fin bloc ligne', end);
    
    // Remplacer le bloc for par asyncPool
    lines[i] = "    await asyncPool(5, refs, async ({ reference_article }) => {";
    // Remplacer continue par return
    for (let j = i+1; j < end; j++) {
      if (lines[j].includes('continue;')) lines[j] = lines[j].replace('continue;', 'return;');
      // Remplacer s. par st. pour eviter conflit avec variable s
      if (lines[j].includes('for (const s of')) lines[j] = lines[j].replace('for (const s of', 'for (const st of');
      if (lines[j].includes('s.StoreId') || lines[j].includes('s.StoreDescription') || lines[j].includes('s.AvailableQty')) {
        lines[j] = lines[j].replace(/\bs\./g, 'st.');
      }
    }
    // Changer la derniere accolade en });
    lines[end-1] = "    });";
    break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK');
