require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');

http.get('http://localhost:3002/reassort-global', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("Clés disponibles dans la réponse :");
      console.log(Object.keys(json));
      
      if (json.bonsTransfert) {
        console.log(`\nbonsTransfert : ${json.bonsTransfert.length} bons`);
        const bon = json.bonsTransfert[0];
        if (bon) {
          console.log("\nPremier bon :");
          console.log(`  codeArticle : ${bon.codeArticle}`);
          console.log(`  donneur : ${bon.donneur}`);
          console.log(`  receveur : ${bon.receveur}`);
          console.log(`  lignes : ${bon.lignes?.length}`);
          if (bon.lignes?.[0]) {
            console.log(`  Première ligne :`);
            console.log(`    ean : ${bon.lignes[0].ean}`);
            console.log(`    taille : ${bon.lignes[0].taille}`);
            console.log(`    couleur : ${bon.lignes[0].couleur}`);
            console.log(`    quantite : ${bon.lignes[0].quantite}`);
          }
        }
      } else {
        console.log("\n❌ bonsTransfert NON présent dans la réponse");
      }
    } catch (e) {
      console.log("Erreur:", e.message);
    }
  });
});