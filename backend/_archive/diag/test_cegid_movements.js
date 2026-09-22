require("dotenv").config();
const cegid = require("../services/cegidService");

async function check() {
  // Lister les services disponibles via WSDL
  const axios = require("axios");
  const url = process.env.CEGID_BASE_URL + "/retail/services/StockMovement?wsdl";
  console.log("Test URL:", url);
  try {
    const r = await axios.get(url, { timeout: 10000 });
    console.log("StockMovement WSDL OK - status:", r.status);
    console.log(r.data.substring(0, 500));
  } catch(e) {
    console.log("StockMovement KO:", e.message);
  }

  // Tester autres endpoints potentiels
  const endpoints = [
    "/retail/services/StockMovement",
    "/retail/services/Inventory", 
    "/retail/services/Reception",
    "/retail/services/Transfer",
    "/retail/services/StockCount"
  ];
  
  for (const ep of endpoints) {
    try {
      const r = await axios.get(process.env.CEGID_BASE_URL + ep + "?wsdl", { timeout: 5000 });
      console.log("?", ep, "- status:", r.status);
    } catch(e) {
      console.log("?", ep, "-", e.message.substring(0, 50));
    }
  }
}
check().catch(console.error);
