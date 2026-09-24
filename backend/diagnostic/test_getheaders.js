require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config/cegid');

const NAMESPACE = 'http://www.cegid.fr/Retail/1.0';
const URL = `${config.baseUrl}/Y2/SaleDocumentService.svc`;
const AUTH = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;

const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="${NAMESPACE}">
  <soap:Body>
    <tns:GetHeaderList>
      <tns:searchRequest>
        <tns:CustomerId>WSN00005</tns:CustomerId>
        <tns:BeginDate>2026-09-01</tns:BeginDate>
        <tns:EndDate>2026-09-15</tns:EndDate>
        <tns:Pager>
          <tns:PageIndex>1</tns:PageIndex>
          <tns:PageSize>5</tns:PageSize>
        </tns:Pager>
      </tns:searchRequest>
      <tns:clientContext>
        <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
      </tns:clientContext>
    </tns:GetHeaderList>
  </soap:Body>
</soap:Envelope>`;

(async () => {
  try {
    const response = await axios.post(URL, soapBody, {
      headers: {
        Authorization: AUTH,
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/ISaleDocumentService/GetHeaderList`
      },
      timeout: 30000
    });
    
    console.log("=== RÉPONSE BRUTE ===");
    console.log(response.data.substring(0, 3000));
    
    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    console.log("\n=== STRUCTURE PARSÉE ===");
    console.log(JSON.stringify(parsed, null, 2).substring(0, 3000));
  } catch (error) {
    console.error("ERREUR:", error.message);
    if (error.response) console.error("Détail:", error.response.data);
  }
})();