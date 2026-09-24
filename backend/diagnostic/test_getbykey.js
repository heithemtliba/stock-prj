require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config/cegid');

const NAMESPACE = 'http://www.cegid.fr/Retail/1.0';
const URL = `${config.baseUrl}/Y2/SaleDocumentService.svc`;
const AUTH = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;

// On utilise la clé du 1er document trouvé
const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="${NAMESPACE}">
  <soap:Body>
    <tns:GetByKey>
      <tns:key>
        <tns:Number>190005034</tns:Number>
        <tns:Stump>019</tns:Stump>
        <tns:Type>CustomerOrder</tns:Type>
      </tns:key>
      <tns:clientContext>
        <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
      </tns:clientContext>
    </tns:GetByKey>
  </soap:Body>
</soap:Envelope>`;

(async () => {
  try {
    const response = await axios.post(URL, soapBody, {
      headers: {
        Authorization: AUTH,
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/ISaleDocumentService/GetByKey`
      },
      timeout: 30000
    });
    
    console.log("=== RÉPONSE BRUTE ===");
    console.log(response.data.substring(0, 5000));
    
    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    console.log("\n=== STRUCTURE PARSÉE ===");
    console.log(JSON.stringify(parsed, null, 2).substring(0, 5000));
  } catch (error) {
    console.error("ERREUR:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Détail:", error.response.data?.substring?.(0, 2000) || error.response.data);
    }
  }
})();