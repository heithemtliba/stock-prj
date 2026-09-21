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
    <tns:GetByKey>
      <tns:searchRequest>
        <tns:Key>
          <tns:Number>1020001873</tns:Number>
          <tns:Stump>I102</tns:Stump>
          <tns:Type>Receipt</tns:Type>
        </tns:Key>
      </tns:searchRequest>
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
    
    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    const result = parsed['s:Envelope']['s:Body']['GetByKeyResponse']['GetByKeyResult'];
    
    console.log("Header:", JSON.stringify(result.Header, null, 2).substring(0, 500));
    console.log("\nLignes:");
    const lines = result.Lines?.Get_Line;
    const list = Array.isArray(lines) ? lines : [lines];
    list.forEach((l, i) => {
      console.log(`${i+1}. ItemCode=${l.ItemCode} | EAN=${l.ItemReference} | Qté=${l.Quantity} | Label=${l.Label}`);
    });
  } catch (error) {
    console.error("ERREUR:", error.message);
    if (error.response) {
      console.error("Détail:", error.response.data?.substring?.(0, 2000) || error.response.data);
    }
  }
})();