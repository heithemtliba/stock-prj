require("dotenv").config();
const axios = require("axios");

async function main() {
  // Cegid Y2 utilise souvent un format different
  const urls = [
    "/retail/services/Reception?WSDL",
    "/retail/services/StockMovement?WSDL", 
    "/Y2/Services/Reception.svc?wsdl",
    "/Y2/Services/StockMovement.svc?wsdl",
    "/Y2/Services/Transfer.svc?wsdl",
  ];
  
  for (const u of urls) {
    try {
      const r = await axios.get(process.env.CEGID_BASE_URL + u, { timeout: 5000 });
      const hasOps = r.data.includes('operation') || r.data.includes('Operation');
      console.log(hasOps ? "?" : "?? ", u, "- status:", r.status, "- ops:", hasOps);
      if (hasOps) {
        const ops = [];
        const regex = /operation name="([^"]+)"/g;
        let m;
        while ((m = regex.exec(r.data)) !== null) ops.push(m[1]);
        ops.slice(0,10).forEach(o => console.log("   -", o));
      }
    } catch(e) {
      console.log("?", u, "-", e.message.substring(0, 60));
    }
  }

  // Verifier aussi le service qu'on utilise deja
  const existing = process.env.CEGID_BASE_URL + "/retail/services/AvailableQtyByStore?wsdl";
  try {
    const r = await axios.get(existing, { timeout: 5000 });
    const ops = [];
    const regex = /operation name="([^"]+)"/g;
    let m;
    while ((m = regex.exec(r.data)) !== null) ops.push(m[1]);
    console.log("\n=== Service existant AvailableQtyByStore ===");
    ops.forEach(o => console.log(" -", o));
  } catch(e) { console.log("KO:", e.message); }
}
main().catch(console.error);
