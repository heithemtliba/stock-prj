const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config/cegid');

const SERVICE_URL = `${config.baseUrl}/Y2/ItemInventoryWcfService.svc`;
const NAMESPACE = 'http://www.cegid.fr/Retail/1.0';

// Par défaut on préfère "répondre vite" plutôt que bloquer une génération de rapport.
// Ajustable via env `CEGID_TIMEOUT_MS`.
const AXIOS_TIMEOUT_MS = Number(process.env.CEGID_TIMEOUT_MS || 8000);

function getAuthHeader() {
  const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  return `Basic ${credentials}`;
}

async function parseXML(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function testConnection() {
  try {
    const response = await axios.get(SERVICE_URL, {
      headers: { Authorization: getAuthHeader() },
      timeout: AXIOS_TIMEOUT_MS
    });
    return { success: true, status: response.status };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function helloWorld() {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
                 xmlns:tns="${NAMESPACE}">
    <soap:Body>
      <tns:HelloWorld>
        <tns:text>Test Mabrouk</tns:text>
        <tns:clientContext>
          <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
        </tns:clientContext>
      </tns:HelloWorld>
    </soap:Body>
  </soap:Envelope>`;

  try {
    const response = await axios.post(SERVICE_URL, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/ICbrBasicWebServiceInterface/HelloWorld`
      },
      timeout: AXIOS_TIMEOUT_MS
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      message: error.message,
      detail: error.response?.data
    };
  }
}

async function getStockAllStores() {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
                 xmlns:tns="${NAMESPACE}">
    <soap:Body>
      <tns:GetAvailableCumulativeQtyAllStores>
        <tns:itemIdentifier>
          <tns:Reference>6191114187658</tns:Reference>
        </tns:itemIdentifier>
        <tns:clientContext>
          <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
        </tns:clientContext>
      </tns:GetAvailableCumulativeQtyAllStores>
    </soap:Body>
  </soap:Envelope>`;

  try {
    const response = await axios.post(SERVICE_URL, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/IItemInventoryWcfService/GetAvailableCumulativeQtyAllStores`
      },
      timeout: AXIOS_TIMEOUT_MS
    });

    const parsed = await parseXML(response.data);
    const result =
      parsed['s:Envelope']['s:Body']['GetAvailableCumulativeQtyAllStoresResponse'][
        'GetAvailableCumulativeQtyAllStoresResult'
      ];

    return {
      success: true,
      stock: parseFloat(result.AvailableQty),
      status: result.QueryStatus
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      message: error.message,
      detail: error.response?.data
    };
  }
}

async function getStockByStore(reference) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
                 xmlns:tns="${NAMESPACE}">
    <soap:Body>
      <tns:GetInventoryDetailByStore>
        <tns:itemIdentifier>
          <tns:Reference>${reference}</tns:Reference>
        </tns:itemIdentifier>
        <tns:clientContext>
          <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
        </tns:clientContext>
      </tns:GetInventoryDetailByStore>
    </soap:Body>
  </soap:Envelope>`;

  try {
    const response = await axios.post(SERVICE_URL, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/IItemInventoryWcfService/GetInventoryDetailByStore`
      },
      timeout: AXIOS_TIMEOUT_MS
    });

    const parsed = await parseXML(response.data);
    const result =
      parsed['s:Envelope']['s:Body']['GetInventoryDetailByStoreResponse'][
        'GetInventoryDetailByStoreResult'
      ];

    return { success: true, reference, stores: result };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      detail: error.response?.data
    };
  }
}

const SALE_SERVICE_URL = `${config.baseUrl}/Y2/SaleDocumentService.svc`;

async function getHistoriqueVentes(storeIds, beginDate, endDate) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
                 xmlns:tns="${NAMESPACE}">
    <soap:Body>
      <tns:GetHeaderList>
        <tns:searchRequest>
          <tns:CustomerId>WSN00005</tns:CustomerId>
          <tns:BeginDate>${beginDate}</tns:BeginDate>
          <tns:EndDate>${endDate}</tns:EndDate>
          <tns:Pager>
            <tns:PageIndex>1</tns:PageIndex>
            <tns:PageSize>20</tns:PageSize>
          </tns:Pager>
        </tns:searchRequest>
        <tns:clientContext>
          <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
        </tns:clientContext>
      </tns:GetHeaderList>
    </soap:Body>
  </soap:Envelope>`;

  try {
    const response = await axios.post(SALE_SERVICE_URL, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/ISaleDocumentService/GetHeaderList`
      },
      timeout: AXIOS_TIMEOUT_MS
    });

    const parsed = await parseXML(response.data);
    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      detail: error.response?.data
    };
  }
}

module.exports = {
  testConnection,
  helloWorld,
  getStockAllStores,
  getStockByStore,
  getHistoriqueVentes
};