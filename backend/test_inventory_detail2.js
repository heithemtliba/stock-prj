require("dotenv").config();
const axios = require("axios");
const xml2js = require("xml2js");
const config = require("./config/cegid");

function getAuthHeader() {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

async function main() {
  const NAMESPACE = 'http://www.cegid.fr/Retail/1.0';
  const SERVICE_URL = `${config.baseUrl}/Y2/ItemInventoryWcfService.svc`;

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                 xmlns:tns="${NAMESPACE}">
    <soap:Body>
      <tns:GetInventoryDetailByStore>
        <tns:itemBarcode>6191114672802</tns:itemBarcode>
        <tns:storeId>019</tns:storeId>
        <tns:clientContext>
          <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
        </tns:clientContext>
      </tns:GetInventoryDetailByStore>
    </soap:Body>
  </soap:Envelope>`;

  try {
    const r = await axios.post(SERVICE_URL, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/IItemInventoryWcfService/GetInventoryDetailByStore`
      },
      timeout: 10000
    });
    // Parser et afficher proprement
    xml2js.parseString(r.data, { explicitArray: false }, (err, result) => {
      const body = result?.['s:Envelope']?.['s:Body'] || result?.Envelope?.Body;
      console.log(JSON.stringify(body, null, 2).substring(0, 3000));
    });
  } catch(e) {
    console.log("Erreur:", e.message);
    if (e.response) console.log(e.response.data.substring(0, 1000));
  }
}
main().catch(console.error);
