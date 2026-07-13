module.exports = {
  baseUrl: process.env.CEGID_BASE_URL,
  username: process.env.CEGID_USERNAME,
  password: process.env.CEGID_PASSWORD,
  databaseId: process.env.CEGID_DATABASE_ID,
  storeIds: process.env.CEGID_STORE_IDS ? process.env.CEGID_STORE_IDS.split(',') : [],
  stores: {
    '030': 'Mabrouk AZUR City',
    '031': 'Mabrouk SOUKRA',
    '011': 'Mabrouk Nabeul',
    '005': 'Mabrouk Jamel Abdennaceur',
    '015': 'Mabrouk Zéphyr',
    '009': 'Mabrouk Sfax',
    '029': 'Mabrouk Sousse',
    '021': 'Mabrouk Tunisia Mall',
    '016': 'Mabrouk Lafayette',
    '002': 'Mabrouk Menzah 6',
    '024': 'Mabrouk Géant',
    '014': 'Mabrouk Carrefour',
    '019': 'Mabrouk e-boutique'
  }
};