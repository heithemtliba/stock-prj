require("dotenv").config();
const axios = require("axios");

async function parseWSDL(endpoint) {
  const url = process.env.CEGID_BASE_URL + endpoint + "?wsdl";
  const r = await axios.get(url, { timeout: 10000 });
  // Extraire les operations
  const ops = [];
  const regex = /<wsdl:operation name="([^"]+)"/g;
  let m;
  while ((m = regex.exec(r.data)) !== null) ops.push(m[1]);
  console.log("\n=== " + endpoint + " ===");
  ops.forEach(o => console.log(" -", o));
}

async function main() {
  await parseWSDL("/retail/services/Reception");
  await parseWSDL("/retail/services/Transfer");
  await parseWSDL("/retail/services/StockMovement");
}
main().catch(console.error);
