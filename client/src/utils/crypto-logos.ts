// Comprehensive cryptocurrency logo mapping and utility functions
// Primary source: CryptoFonts CDN (https://cryptofonts.com)

// Clean up coin codes and names (remove underscores, fix formatting)
export const cleanCoinCode = (code: string) => {
  return code.replace(/^_+|_+$/g, '').replace(/_+/g, ' ');
};

export const cleanCoinName = (name: string) => {
  return name.replace(/^_+|_+$/g, '').replace(/_+/g, ' ');
};

// CryptoFonts CDN base URL
const CRYPTOFONTS_BASE = 'https://cryptofonts.com/img/SVG';

// Code remapping for tokens whose CryptoFonts filename differs from their ticker
const CODE_REMAP: Record<string, string> = {
  'TONCOIN': 'ton',
  'MIOTA': 'iota',
};

// Tokens not on CryptoFonts — fallback to CoinMarketCap
const CMC_OVERRIDES: Record<string, string> = {
  'BONK': 'https://s2.coinmarketcap.com/static/img/coins/32x32/23095.png',
  'BRETT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/30479.png',
  'WIF': 'https://s2.coinmarketcap.com/static/img/coins/32x32/28752.png',
  'SYRUP': 'https://s2.coinmarketcap.com/static/img/coins/32x32/7186.png',
};

// OEC custom token — not on any public logo CDN
const OEC_LOGO = 'https://pub-37d61a7eb7ae45898b46702664710cb2.r2.dev/images/OEC%20Logo%20Square.png';

// Get logo URL for a cryptocurrency
export const getCryptoLogo = (code: string, symbol?: string) => {
  const cleanedCode = cleanCoinCode(code).trim();
  const upperCode = cleanedCode.toUpperCase();

  // OEC is a custom token
  if (upperCode === 'OEC') return OEC_LOGO;

  // Check CoinMarketCap overrides for tokens missing from CryptoFonts
  if (CMC_OVERRIDES[upperCode]) return CMC_OVERRIDES[upperCode];

  // Remap code if needed, otherwise use cleaned lowercase
  const fontCode = CODE_REMAP[upperCode] || cleanedCode.toLowerCase();

  // Return CryptoFonts SVG URL
  return `${CRYPTOFONTS_BASE}/${fontCode}.svg`;
};

// Fallback avatar for tokens with no logo at all (used by onError handlers)
export const getFallbackAvatar = (symbol: string) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(symbol)}&background=0066cc&color=fff&size=32`;
};

// Clean and format crypto data for UI display
export const formatCryptoData = (coin: any) => {
  const cleanedCode = cleanCoinCode(coin.code);
  const cleanedName = cleanCoinName(coin.name);

  return {
    ...coin,
    cleanCode: cleanedCode,
    cleanName: cleanedName,
    logo: getCryptoLogo(coin.code, cleanedCode),
  };
};
