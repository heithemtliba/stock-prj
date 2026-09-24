module.exports = {
  baseUrl: process.env.CEGID_BASE_URL,
  username: process.env.CEGID_USERNAME,
  password: process.env.CEGID_PASSWORD,
  databaseId: process.env.CEGID_DATABASE_ID,
  storeIds: process.env.CEGID_STORE_IDS ? process.env.CEGID_STORE_IDS.split(',') : [],
  stores: {
    '002': 'Mabrouk Menzah 6',
    '005': 'Mabrouk Jamel Abdennaceur',
    '009': 'Mabrouk Sfax',
    '011': 'Mabrouk Nabeul',
    '014': 'Mabrouk Carrefour',
    '015': 'Mabrouk Zéphyr',
    '016': 'Mabrouk Lafayette',
    '019': 'Mabrouk e-boutique',
    '021': 'Mabrouk Tunisia Mall',
    '024': 'Mabrouk Géant',
    '029': 'Mabrouk Sousse',
    '030': 'Mabrouk AZUR City',
    '031': 'Mabrouk SOUKRA',
    '032': 'Mabrouk Sfax Mall',
    '033': 'Mabrouk Lac Premium'
  }
};