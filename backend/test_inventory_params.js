require("dotenv").config();
const axios = require("axios");
const config = require("./config/cegid");

function getAuthHeader() {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

async function tryCall(paramName, paramValue, storeParam, storeValue) {
  const NAMESPACE = 'http://www.cegid.fr/Retail/1.0';
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${NAMESPACE}">
    <soap:Body>
      <tns:GetInventoryDetailByStore>
        <tns:${paramName}>${paramValue}</tns:${paramName}>
        <tns:${storeParam}>${storeValue}</tns:${storeParam}>
        <tns:clientContext><tns:DatabaseId>${config.databaseId}</tns:DatabaseId></tns:clientContext>
      </tns:GetInventoryDetailByStore>
    </soap:Body>
  </soap:Envelope>`;
  try {
    const r = await axios.post(`${config.baseUrl}/Y2/ItemInventoryWcfService.svc`, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/IItemInventoryWcfService/GetInventoryDetailByStore`
      },
      timeout: 8000
    });
    console.log(`? ${paramName}=${paramValue} ${storeParam}=${storeValue}`);
    console.log(r.data.substring(0, 800));
  } catch(e) {
    const msg = e.response?.data?.substring(0,150) || e.message;
    console.log(`? ${paramName}=${paramValue}: ${msg}`);
  }
}

async function main() {
  // Article 22414, EAN 6191114672802, boutique 019
  await tryCall('itemId', '22414',     'storeId', '019');
  await tryCall('reference', '6191114672802', 'storeId', '019');
  await tryCall('itemReference', '6191114672802', 'storeId', '019');
  await tryCall('itemBarcode', '6191114672802', 'storeId', '019');
  await tryCall('barcode', '6191114672802', 'storeId', '019');
}
main().catch(console.error);
