// Comprehensive cryptocurrency logo mapping and utility functions

// Clean up coin codes and names (remove underscores, fix formatting)
export const cleanCoinCode = (code: string) => {
  return code.replace(/^_+|_+$/g, '').replace(/_+/g, ' ');
};

export const cleanCoinName = (name: string) => {
  return name.replace(/^_+|_+$/g, '').replace(/_+/g, ' ');
};

// Comprehensive token logos mapping for top 100+ cryptocurrencies
export const cryptoLogos: { [key: string]: string } = {
  // Top 20 major cryptocurrencies
  'BTC': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1.png',
  'ETH': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1027.png',
  'XRP': 'https://s2.coinmarketcap.com/static/img/coins/32x32/52.png',
  'USDT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/825.png',
  'BNB': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1839.png',
  'SOL': 'https://s2.coinmarketcap.com/static/img/coins/32x32/5426.png',
  'USDC': 'https://s2.coinmarketcap.com/static/img/coins/32x32/3408.png',
  'TRX': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1958.png',
  'ADA': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2010.png',
  'DOGE': 'https://s2.coinmarketcap.com/static/img/coins/32x32/74.png',
  'XLM': 'https://s2.coinmarketcap.com/static/img/coins/32x32/512.png',
  '_SUI': 'https://s2.coinmarketcap.com/static/img/coins/32x32/20947.png',
  'SUI': 'https://s2.coinmarketcap.com/static/img/coins/32x32/20947.png',
  'BCH': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1831.png',
  'LINK': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1975.png',
  'HBAR': 'https://s2.coinmarketcap.com/static/img/coins/32x32/4642.png',
  '______HYPE': 'https://s2.coinmarketcap.com/static/img/coins/32x32/33396.png',
  'HYPE': 'https://s2.coinmarketcap.com/static/img/coins/32x32/33396.png',
  'AVAX': 'https://s2.coinmarketcap.com/static/img/coins/32x32/5805.png',
  'WBT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1.png', // Fallback to BTC
  'LTC': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2.png',
  'TONCOIN': 'https://s2.coinmarketcap.com/static/img/coins/32x32/11419.png',
  'DOT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/6636.png',
  'UNI': 'https://s2.coinmarketcap.com/static/img/coins/32x32/7083.png',
  // 21-50 range
  'MATIC': 'https://s2.coinmarketcap.com/static/img/coins/32x32/3890.png',
  'ICP': 'https://s2.coinmarketcap.com/static/img/coins/32x32/8916.png',
  'ATOM': 'https://s2.coinmarketcap.com/static/img/coins/32x32/3794.png',
  'ETC': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1321.png',
  'VET': 'https://s2.coinmarketcap.com/static/img/coins/32x32/3077.png',
  'FIL': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2280.png',
  'ALGO': 'https://s2.coinmarketcap.com/static/img/coins/32x32/4030.png',
  'NEAR': 'https://s2.coinmarketcap.com/static/img/coins/32x32/6535.png',
  'APT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/21794.png',
  'CAKE': 'https://s2.coinmarketcap.com/static/img/coins/32x32/7186.png',
  'THETA': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2416.png',
  'FLOW': 'https://s2.coinmarketcap.com/static/img/coins/32x32/4558.png',
  'SAND': 'https://s2.coinmarketcap.com/static/img/coins/32x32/6210.png',
  'MANA': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1966.png',
  'XTZ': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2011.png',
  'EGLD': 'https://s2.coinmarketcap.com/static/img/coins/32x32/6892.png',
  'AAVE': 'https://s2.coinmarketcap.com/static/img/coins/32x32/7278.png',
  'GRT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/6719.png',
  'KLAY': 'https://s2.coinmarketcap.com/static/img/coins/32x32/4256.png',
  'AXS': 'https://s2.coinmarketcap.com/static/img/coins/32x32/6783.png',
  // 51-100 range
  'ROSE': 'https://s2.coinmarketcap.com/static/img/coins/32x32/7653.png',
  'FTM': 'https://s2.coinmarketcap.com/static/img/coins/32x32/3513.png',
  'NEO': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1376.png',
  'CHZ': 'https://s2.coinmarketcap.com/static/img/coins/32x32/4066.png',
  'ENJ': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2130.png',
  'GALA': 'https://s2.coinmarketcap.com/static/img/coins/32x32/7080.png',
  'ZEC': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1437.png',
  'MIOTA': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1720.png',
  'DASH': 'https://s2.coinmarketcap.com/static/img/coins/32x32/131.png',
  'ZIL': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2687.png',
  'BAT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1697.png',
  'LRC': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1934.png',
  'HOT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2682.png',
  'ICX': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2099.png',
  'ONT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2566.png',
  'WRX': 'https://s2.coinmarketcap.com/static/img/coins/32x32/5161.png',
  'STX': 'https://s2.coinmarketcap.com/static/img/coins/32x32/4847.png',
  'QTUM': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1684.png',
  'XMR': 'https://s2.coinmarketcap.com/static/img/coins/32x32/328.png',
  'SEI': 'https://s2.coinmarketcap.com/static/img/coins/32x32/23095.png',
  'JTO': 'https://s2.coinmarketcap.com/static/img/coins/32x32/28541.png',
  '__BRETT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/30479.png',
  'BRETT': 'https://s2.coinmarketcap.com/static/img/coins/32x32/30479.png',
  'SYRUP': 'https://s2.coinmarketcap.com/static/img/coins/32x32/7186.png', // PancakeSwap related
  'ZRX': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1896.png',
  'COMP': 'https://s2.coinmarketcap.com/static/img/coins/32x32/5692.png',
  'YFI': 'https://s2.coinmarketcap.com/static/img/coins/32x32/5864.png',
  'SUSHI': 'https://s2.coinmarketcap.com/static/img/coins/32x32/6758.png',
  'CRV': 'https://s2.coinmarketcap.com/static/img/coins/32x32/6538.png',
  'MKR': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1518.png',
  'SNX': 'https://s2.coinmarketcap.com/static/img/coins/32x32/2586.png',
  'KNC': 'https://s2.coinmarketcap.com/static/img/coins/32x32/1982.png',
  'BAND': 'https://s2.coinmarketcap.com/static/img/coins/32x32/4679.png',
  'DYDX': 'https://s2.coinmarketcap.com/static/img/coins/32x32/11156.png',
  'IMX': 'https://s2.coinmarketcap.com/static/img/coins/32x32/10603.png',
  'LDO': 'https://s2.coinmarketcap.com/static/img/coins/32x32/8000.png',
  'ARB': 'https://s2.coinmarketcap.com/static/img/coins/32x32/11841.png',
  'OP': 'https://s2.coinmarketcap.com/static/img/coins/32x32/11840.png',
  'MINA': 'https://s2.coinmarketcap.com/static/img/coins/32x32/5647.png',
  'CELO': 'https://s2.coinmarketcap.com/static/img/coins/32x32/5567.png',
  'WLD': 'https://s2.coinmarketcap.com/static/img/coins/32x32/26700.png',
  'INJ': 'https://s2.coinmarketcap.com/static/img/coins/32x32/7226.png',
  'TIA': 'https://s2.coinmarketcap.com/static/img/coins/32x32/22861.png',
  'PENDLE': 'https://s2.coinmarketcap.com/static/img/coins/32x32/9481.png',
  'BLUR': 'https://s2.coinmarketcap.com/static/img/coins/32x32/23121.png',
  'PEPE': 'https://s2.coinmarketcap.com/static/img/coins/32x32/24478.png',
  'WIF': 'https://s2.coinmarketcap.com/static/img/coins/32x32/28752.png',
  'SHIB': 'https://s2.coinmarketcap.com/static/img/coins/32x32/5994.png',
  'FLOKI': 'https://s2.coinmarketcap.com/static/img/coins/32x32/10804.png',
  'BONK': 'https://s2.coinmarketcap.com/static/img/coins/32x32/23095.png',
};

// Get logo for a cryptocurrency with fallback
export const getCryptoLogo = (code: string, symbol?: string) => {
  const cleanedCode = cleanCoinCode(code);
  const displaySymbol = symbol || cleanedCode;
  
  // Debug logging to help identify logo mapping issues
  console.log(`getCryptoLogo called with code: "${code}", symbol: "${symbol}", cleanedCode: "${cleanedCode}"`);
  const logo = cryptoLogos[code];
  console.log(`Found logo for ${code}:`, logo);
  
  return logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(displaySymbol)}&background=0066cc&color=fff&size=32`;
};

// Clean and format crypto data for UI display
export const formatCryptoData = (coin: any) => {
  const cleanedCode = cleanCoinCode(coin.code);
  const cleanedName = cleanCoinName(coin.name);
  
  return {
    ...coin,
    cleanCode: cleanedCode,
    cleanName: cleanedName,
    logo: getCryptoLogo(coin.code, cleanedCode)
  };
};