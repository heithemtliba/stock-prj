require("dotenv").config();
const axios = require("axios");
const config = require("../config/cegid");

function getAuthHeader() {
  const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  return `Basic ${credentials}`;
}

async function main() {
  // Tester le WSDL du service existant
  const baseUrl = config.baseUrl;
  const services = [
    "/Y2/ItemInventoryWcfService.svc?wsdl",
    "/Y2/ItemInventoryWcfService.svc?WSDL",
    "/Y2/StockMovementWcfService.svc?wsdl",
    "/Y2/ReceptionWcfService.svc?wsdl",
    "/Y2/TransferWcfService.svc?wsdl",
    "/Y2/ItemReceiptWcfService.svc?wsdl",
  ];

  for (const svc of services) {
    try {
      const r = await axios.get(baseUrl + svc, {
        headers: { Authorization: getAuthHeader() },
        timeout: 8000
      });
      const ops = [];
      const regex = /operation name="([^"]+)"/g;
      let m;
      while ((m = regex.exec(r.data)) !== null) ops.push(m[1]);
      console.log(ops.length > 0 ? "?" : "?? ", svc, "- ops:", ops.length);
      ops.forEach(o => console.log("   -", o));
    } catch(e) {
      console.log("?", svc, "-", e.message.substring(0, 50));
    }
  }
}
main().catch(console.error);
