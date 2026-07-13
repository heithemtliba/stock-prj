require("dotenv").config();
const axios = require("axios");
const config = require("./config/cegid");

function getAuthHeader() {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

async function main() {
  // Essayer xsd=xsd0, xsd1, xsd2
  for (const xsd of ['xsd0','xsd1','xsd2','xsd3']) {
    try {
      const r = await axios.get(`${config.baseUrl}/Y2/ItemInventoryWcfService.svc?wsdl=${xsd}`, {
        headers: { Authorization: getAuthHeader() },
        timeout: 8000
      });
      const idx = r.data.indexOf('GetInventoryDetailByStore');
      if (idx > -1) {
        console.log(`\n=== ${xsd} - GetInventoryDetailByStore ===`);
        console.log(r.data.substring(idx - 50, idx + 600));
      } else {
        console.log(`${xsd}: pas de GetInventoryDetailByStore (${r.data.length} chars)`);
      }
    } catch(e) { console.log(`${xsd}: ${e.message}`); }
  }
}
main().catch(console.error);
