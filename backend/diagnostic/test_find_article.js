require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config/cegid');

const NAMESPACE = 'http://www.cegid.fr/Retail/1.0';
const URL = `${config.baseUrl}/Y2/SaleDocumentService.svc`;
const AUTH = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;

async function getHeaders() {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${NAMESPACE}">
  <soap:Body>
    <tns:GetHeaderList>
      <tns:searchRequest>
        <tns:BeginDate>2026-09-01T00:00:00</tns:BeginDate>
        <tns:EndDate>2026-09-15T00:00:00</tns:EndDate>
        <tns:Pager><tns:PageIndex>1</tns:PageIndex><tns:PageSize>20</tns:PageSize></tns:Pager>
      </tns:searchRequest>
      <tns:clientContext><tns:DatabaseId>${config.databaseId}</tns:DatabaseId></tns:clientContext>
    </tns:GetHeaderList>
  </soap:Body>
</soap:Envelope>`;
  
  const r = await axios.post(URL, soapBody, {
    headers: { Authorization: AUTH, 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `${NAMESPACE}/ISaleDocumentService/GetHeaderList` },
    timeout: 30000
  });
  const p = await xml2js.parseStringPromise(r.data, { explicitArray: false });
  const h = p['s:Envelope']['s:Body']['GetHeaderListResponse']['GetHeaderListResult']['Headers'];
  return Array.isArray(h.Get_Header) ? h.Get_Header : [h.Get_Header];
}

async function getDetail(key) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${NAMESPACE}">
  <soap:Body>
    <tns:GetByKey>
      <tns:searchRequest>
        <tns:Key><tns:Number>${key.Number}</tns:Number><tns:Stump>${key.Stump}</tns:Stump><tns:Type>${key.Type}</tns:Type></tns:Key>
      </tns:searchRequest>
      <tns:clientContext><tns:DatabaseId>${config.databaseId}</tns:DatabaseId></tns:clientContext>
    </tns:GetByKey>
  </soap:Body>
</soap:Envelope>`;
  
  const r = await axios.post(URL, soapBody, {
    headers: { Authorization: AUTH, 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `${NAMESPACE}/ISaleDocumentService/GetByKey` },
    timeout: 30000
  });
  const p = await xml2js.parseStringPromise(r.data, { explicitArray: false });
  return p['s:Envelope']['s:Body']['GetByKeyResponse']['GetByKeyResult'];
}

(async () => {
  const headers = await getHeaders();
  console.log(`${headers.length} documents trouvés\n`);
  
  for (const h of headers.slice(0, 5)) {
    console.log(`\n=== Document ${h.Key.Number}/${h.Key.Stump} (${h.Date}) ===`);
    const detail = await getDetail(h.Key);
    const lines = detail.Lines?.Get_Line;
    const list = Array.isArray(lines) ? lines : [lines];
    list.filter(l => l && !l.ItemCode?.startsWith('TAXE')).forEach((l, i) => {
      console.log(`${i+1}. ItemCode=${l.ItemCode} | EAN=${l.ItemReference} | Qté=${l.Quantity}`);
      console.log(`   Label=${l.Label}`);
      console.log(`   CatalogReference=${l.CatalogReference || '(vide)'}`);
      console.log(`   ComplementaryDescription=${l.ComplementaryDescription || '(vide)'}`);
    });
  }
})();