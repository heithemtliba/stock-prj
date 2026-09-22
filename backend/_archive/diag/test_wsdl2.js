require("dotenv").config();
const axios = require("axios");
const config = require("../config/cegid");

function getAuthHeader() {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

async function main() {
  // Charger le wsdl0 qui contient les types
  const r = await axios.get(`${config.baseUrl}/Y2/ItemInventoryWcfService.svc?wsdl=wsdl0`, {
    headers: { Authorization: getAuthHeader() },
    timeout: 10000
  });
  // Chercher GetInventoryDetailByStore dans le WSDL
  const idx = r.data.indexOf('GetInventoryDetailByStore');
  if (idx > -1) {
    console.log(r.data.substring(idx - 200, idx + 1000));
  } else {
    console.log("Non trouve - affichage debut:");
    console.log(r.data.substring(0, 3000));
  }
}
main().catch(console.error);
