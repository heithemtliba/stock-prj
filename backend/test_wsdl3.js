require("dotenv").config();
const axios = require("axios");
const config = require("./config/cegid");

function getAuthHeader() {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

async function main() {
  const r = await axios.get(`${config.baseUrl}/Y2/ItemInventoryWcfService.svc?wsdl=wsdl0`, {
    headers: { Authorization: getAuthHeader() },
    timeout: 10000
  });
  
  // Chercher le schema de GetInventoryDetailByStore
  const idx = r.data.indexOf('"GetInventoryDetailByStore"');
  if (idx > -1) {
    console.log("=== Schema GetInventoryDetailByStore ===");
    console.log(r.data.substring(idx - 100, idx + 800));
  }
  
  // Chercher aussi GetListItemInventoryDetailByStore
  const idx2 = r.data.indexOf('"GetListItemInventoryDetailByStore"');
  if (idx2 > -1) {
    console.log("\n=== Schema GetListItemInventoryDetailByStore ===");
    console.log(r.data.substring(idx2 - 100, idx2 + 800));
  }
}
main().catch(console.error);
