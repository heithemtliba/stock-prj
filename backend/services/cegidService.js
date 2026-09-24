const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config/cegid');

const SERVICE_URL = `${config.baseUrl}/Y2/ItemInventoryWcfService.svc`;
const NAMESPACE = 'http://www.cegid.fr/Retail/1.0';

// Par défaut on préfère "répondre vite" plutôt que bloquer une génération de rapport.
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

// ─── PRODUCT MERCHANDISE ITEMS SERVICE (Articles) ──────────────────────
const ARTICLE_SERVICE_URL = `${config.baseUrl}/Y2/ProductMerchandiseItemsService.svc`;
const ARTICLE_NAMESPACE = 'http://www.cegid.fr/Retail/1.0';
const ARRAY_NAMESPACE = 'http://schemas.microsoft.com/2003/10/Serialization/Arrays';

async function getArticlesList(ids, type = 'Barcodes', fields = ['SystemFields', 'Characteristics']) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: true, articles: [] };
  }
  if (ids.length > 1000) {
    throw new Error('GetListDetail accepte au maximum 1000 IDs par appel');
  }

  const idsXml = ids.map(id => `<a:string>${id}</a:string>`).join('');
  const fieldsXml = fields.map(f => `<tns:FieldsType>${f}</tns:FieldsType>`).join('');

  function buildSoapBody(pageIndex, pageSize) {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:tns="${ARTICLE_NAMESPACE}"
               xmlns:a="${ARRAY_NAMESPACE}">
  <soap:Body>
    <tns:GetListDetail>
      <tns:Request>
        <tns:${type}>
          ${idsXml}
        </tns:${type}>
        <tns:Fields>
          ${fieldsXml}
        </tns:Fields>
        <tns:Paging>
          <tns:PageIndex>${pageIndex}</tns:PageIndex>
          <tns:PageSize>${pageSize}</tns:PageSize>
        </tns:Paging>
      </tns:Request>
      <tns:Context>
        <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
      </tns:Context>
    </tns:GetListDetail>
  </soap:Body>
</soap:Envelope>`;
  }

  function cleanArticle(item) {
    const rawId = item?.Identification?.Identifier?.Id || '';
    const cleanId = String(rawId).trim().split(/\s+/)[0] || '';
    return {
      cegidId: cleanId,
      barcode: item?.Identification?.Identifier?.Barcode || '',
      libelle: item?.Description || '',
      libelleCompl: item?.Characteristics?.ComplementaryDescription || '',
      collection: item?.Characteristics?.Collections?.Current || '',
      fournisseur: item?.Characteristics?.MainSupplierId || '',
      famille: item?.Characteristics?.Categories?.Category?.[0]?.Id || '',
      closed: item?.Closed === 'true' || item?.Closed === true,
      status: item?.Status || '',
      salesSuspended: item?.Characteristics?.Properties?.SalesSuspended === 'true',
      replenishmentExcluded: item?.Characteristics?.Properties?.ReplenishmentExcluded === 'true',
      inventoryManagement: item?.Characteristics?.Properties?.InventoryManagement === 'true',
      dateCreation: item?.SystemFields?.CreationDate || '',
      dateUpdateServer: item?.SystemFields?.ServerUpdateDate || '',
      dateUpdate: item?.SystemFields?.UpdateDate || ''
    };
  }

  const allArticles = [];
  const pageSize = 1000;
  let pageIndex = 1;
  const MAX_PAGES = 100;

  try {
    while (pageIndex <= MAX_PAGES) {
      const soapBody = buildSoapBody(pageIndex, pageSize);
      const response = await axios.post(ARTICLE_SERVICE_URL, soapBody, {
        headers: {
          Authorization: getAuthHeader(),
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `${ARTICLE_NAMESPACE}/IMerchandiseItemsWebService/GetListDetail`
        },
        timeout: Number(process.env.CEGID_ARTICLES_TIMEOUT_MS || 30000)
      });

      const parsed = await parseXML(response.data);
      const result = parsed['s:Envelope']?.['s:Body']?.['GetListDetailResponse']?.['GetListDetailResult'];
      if (!result) break;

      const items = result.MerchandiseItems?.MerchandiseItem;
      const list = Array.isArray(items) ? items : (items ? [items] : []);

      if (list.length === 0) break;

      allArticles.push(...list.map(cleanArticle));

      const pagination = result.Pagination;
      if (!pagination || Number(pagination.Count) < pageSize) break;

      pageIndex++;
    }

    return {
      success: true,
      articles: allArticles,
      totalPages: pageIndex
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

// ─── PRIX DE VENTE (RetailSalesPriceEngine2Service) ────────────────────
const SALE_PRICE_SERVICE_URL = `${config.baseUrl}/Y2/RetailSalesPriceEngine2Service.svc`;
const SALE_PRICE_NAMESPACE = 'http://www.cegid.fr/Retail/1.0';

/**
 * Récupère les prix de vente pour une liste de barcodes.
 * @param {string[]} barcodes - Liste de barcodes (max 1000)
 * @param {string} storeId - Code magasin (ex: '001')
 * @param {string} date - Date d'application (YYYY-MM-DD ou null pour aujourd'hui)
 * @param {boolean} taxExcluded - true = HT, false = TTC
 */
async function getSalePrices(barcodes, storeId = '001', date = null, taxExcluded = false) {
  if (!Array.isArray(barcodes) || barcodes.length === 0) {
    return { success: true, prices: [] };
  }
  if (barcodes.length > 1000) {
    throw new Error('GetListDetail accepte au maximum 1000 barcodes par appel');
  }

  const dateStr = date ? `${date}T00:00:00` : `${new Date().toISOString().slice(0, 10)}T00:00:00`;
  const barcodesXml = barcodes.map(b => `<a:string>${b}</a:string>`).join('');

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:tns="${SALE_PRICE_NAMESPACE}"
               xmlns:a="${ARRAY_NAMESPACE}">
  <soap:Body>
    <tns:GetListDetail>
      <tns:Request>
        <tns:Barcodes>
          ${barcodesXml}
        </tns:Barcodes>
        <tns:Date>${dateStr}</tns:Date>
        <tns:StoreId>${storeId}</tns:StoreId>
        <tns:TaxExcluded>${taxExcluded}</tns:TaxExcluded>
      </tns:Request>
      <tns:Context>
        <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
      </tns:Context>
    </tns:GetListDetail>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await axios.post(SALE_PRICE_SERVICE_URL, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${SALE_PRICE_NAMESPACE}/IEngine2WebService/GetListDetail`
      },
      timeout: Number(process.env.CEGID_PRICES_TIMEOUT_MS || 30000)
    });

    const parsed = await parseXML(response.data);
    const result = parsed['s:Envelope']?.['s:Body']?.['GetListDetailResponse']?.['GetListDetailResult'];
    if (!result) return { success: true, prices: [] };

    const pricesList = result.Prices?.Price;
    const list = Array.isArray(pricesList) ? pricesList : (pricesList ? [pricesList] : []);

    return {
      success: true,
      currencyId: result.CurrencyId || 'TND',
      prices: list.map(p => ({
        barcode: p.Barcode || '',
        itemId: String(p.ItemId || '').trim().split(/\s+/)[0] || '',
        basePrice: parseFloat(p.UnitPrice?.Base) || 0,
        currentPrice: parseFloat(p.UnitPrice?.Current) || 0,
        discountPercent: parseFloat(p.UnitPrice?.DiscountPercent) || 0,
        markdownReasonId: p.UnitPrice?.MarkdownReasonId || '',
        periodId: p.PeriodId || '',
        priceListTypeId: p.PriceListTypeId || ''
      }))
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

module.exports = {
  testConnection,
  helloWorld,
  getStockAllStores,
  getStockByStore,
  getHistoriqueVentes,
  getArticlesList,
  getSalePrices
};