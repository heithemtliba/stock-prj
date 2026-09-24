require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');

const codes = [
  // Chers
  '21975', '21971', '21974', '22093', '70255', '70248',
  // Pas chers
  '21355', '21832', '21351', '21831', '21830', '21827'
];

http.get('http://localhost:3002/reassort-global', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const all = [...(json.critique || []), ...(json.faible || []), ...(json.ok || [])];
      
      console.log("Scores des articles :\n");
      console.log("CHERS (> 200 TND):");
      for (const code of ['21975', '21971', '21974', '22093', '70255', '70248']) {
        const art = all.find(a => String(a.codeArticle) === code);
        if (art) {
          console.log(`  ${code} : score=${art.score}, ventes/sem=${art.ventesParSemaine}`);
        } else {
          console.log(`  ${code} : NON TROUVÉ`);
        }
      }
      
      console.log("\nPAS CHERS (< 50 TND):");
      for (const code of ['21355', '21832', '21351', '21831', '21830', '21827']) {
        const art = all.find(a => String(a.codeArticle) === code);
        if (art) {
          console.log(`  ${code} : score=${art.score}, ventes/sem=${art.ventesParSemaine}`);
        } else {
          console.log(`  ${code} : NON TROUVÉ`);
        }
      }
    } catch (e) {
      console.log("Erreur:", e.message);
      console.log("Réponse:", data.substring(0, 500));
    }
  });
});