require("dotenv").config();
const c = require("./services/cegidService");

async function test() {
  console.log("URL:", process.env.CEGID_BASE_URL);
  console.log("User:", process.env.CEGID_USERNAME);
  console.log("DB:", process.env.CEGID_DATABASE_ID);
  
  console.log("\nTest connexion...");
  const conn = await c.testConnection();
  console.log("Connexion:", JSON.stringify(conn));

  console.log("\nTest stock article 22064...");
  const stock = await c.getStockByStore("22064");
  console.log("Stock:", JSON.stringify(stock, null, 2));
}

test();
