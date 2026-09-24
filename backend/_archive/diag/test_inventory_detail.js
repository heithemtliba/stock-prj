require("dotenv").config();
const axios = require("axios");
const config = require("../config/cegid");

function getAuthHeader() {
  const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  return `Basic ${credentials}`;
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
        SOAPAction: `${NAMESPACE}/ICbrBasicWebServiceInterface/GetInventoryDetailByStore`
      },
      timeout: 10000
    });
    console.log("Response:");
    console.log(r.data.substring(0, 2000));
  } catch(e) {
    console.log("Erreur:", e.message);
    if (e.response) console.log(e.response.data.substring(0, 500));
  }
}
main().catch(console.error);
