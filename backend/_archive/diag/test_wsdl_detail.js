require("dotenv").config();
const axios = require("axios");
const config = require("../config/cegid");

function getAuthHeader() {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

async function main() {
  const r = await axios.get(`${config.baseUrl}/Y2/ItemInventoryWcfService.svc?wsdl`, {
    headers: { Authorization: getAuthHeader() },
    timeout: 10000
  });
  // Afficher tout le WSDL pour trouver les bons namespaces et actions
  console.log(r.data.substring(0, 5000));
}
main().catch(console.error);
