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
        <tns:BeginDate>2026-09-01T00:00:00</tns:BeginDate>
        <tns:EndDate>2026-09-15T00:00:00</tns:EndDate>
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
    
    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    const headers = parsed['s:Envelope']['s:Body']['GetHeaderListResponse']['GetHeaderListResult']['Headers'];
    
    if (!headers) {
      console.log("Aucun header retourné");
      console.log(JSON.stringify(parsed, null, 2).substring(0, 2000));
      return;
    }
    
    const list = Array.isArray(headers.Get_Header) ? headers.Get_Header : [headers.Get_Header];
    console.log(`\n${list.length} documents trouvés :`);
    list.forEach((h, i) => {
      console.log(`${i+1}. ${h.Date} | Store ${h.StoreId} | Qté ${h.TotalQuantity} | ${h.Key.Number}/${h.Key.Stump}/${h.Key.Type}`);
    });
  } catch (error) {
    console.error("ERREUR:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Détail:", error.response.data?.substring?.(0, 2000) || error.response.data);
    }
  }
})();