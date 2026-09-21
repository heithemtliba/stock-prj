require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');

const codes = ['22064', '55845', '91276', '21830', '21831'];

http.get('http://localhost:3002/reassort-global', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const all = [...(json.critique || []), ...(json.faible || []), ...(json.ok || [])];
      
      console.log("Scores des articles :\n");
      for (const code of codes) {
        const art = all.find(a => String(a.codeArticle) === code);
        if (art) {
          console.log(`  ${code} : score=${art.score}, ventes/sem=${art.ventesParSemaine}`);
        } else {
          console.log(`  ${code} : NON TROUVÉ (exclu ou pas dans le top 100)`);
        }
      }
    } catch (e) {
      console.log("Erreur:", e.message);
      console.log("Réponse:", data.substring(0, 500));
    }
  });
});