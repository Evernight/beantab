import {
  red,
  pink,
  purple,
  deepPurple,
  indigo,
  blue,
  lightBlue,
  cyan,
  teal,
  green,
  lightGreen,
  lime,
  yellow,
  amber,
  orange,
  deepOrange,
  brown,
  grey,
  blueGrey,
} from "@mui/material/colors";

// Material UI color palette mapping for currencies
const CURRENCY_COLOR_MAP: Record<string, string> = {
  // Major world currencies
  USD: blue[600], // US Dollar - Blue
  EUR: indigo[600], // Euro - Indigo
  GBP: blueGrey[600], // British Pound - Blue Grey
  JPY: red[600], // Japanese Yen - Red
  CHF: green[600], // Swiss Franc - Green
  CAD: teal[600], // Canadian Dollar - Teal
  AUD: cyan[600], // Australian Dollar - Cyan
  NZD: lightBlue[600], // New Zealand Dollar - Light Blue

  // European currencies
  SEK: deepPurple[600], // Swedish Krona - Deep Purple
  NOK: pink[600], // Norwegian Krone - Pink
  DKK: lightGreen[600], // Danish Krone - Light Green
  PLN: amber[600], // Polish Zloty - Amber
  CZK: orange[600], // Czech Koruna - Orange
  HUF: brown[600], // Hungarian Forint - Brown

  // Asian currencies
  CNY: yellow[700], // Chinese Yuan - Yellow
  KRW: deepOrange[600], // South Korean Won - Deep Orange
  SGD: lime[700], // Singapore Dollar - Lime
  HKD: blueGrey[600], // Hong Kong Dollar - Blue Grey
  THB: grey[600], // Thai Baht - Grey
  INR: orange[700], // Indian Rupee - Orange

  // Other currencies
  BRL: green[700], // Brazilian Real - Green
  MXN: red[700], // Mexican Peso - Red
  ZAR: purple[700], // South African Rand - Purple
  RUB: indigo[700], // Russian Ruble - Indigo
  TRY: teal[700], // Turkish Lira - Teal

  // Cryptocurrencies
  BTC: orange[600], // Bitcoin - Orange
  ETH: blue[700], // Ethereum - Blue
  LTC: grey[700], // Litecoin - Grey
  XRP: blue[800], // Ripple - Blue
  ADA: green[800], // Cardano - Green
  DOT: pink[700], // Polkadot - Pink
  SOL: purple[800], // Solana - Purple
  MATIC: purple[600], // Polygon - Purple
  AVAX: red[800], // Avalanche - Red
  LINK: blue[900], // Chainlink - Blue
};

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CHF: "CHF",
  CAD: "$",
  AUD: "$",
  NZD: "$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
  CNY: "¥",
  KRW: "₩",
  SGD: "$",
  HKD: "$",
  THB: "฿",
  INR: "₹",
  BRL: "R$",
  MXN: "$",
  ZAR: "R",
  RUB: "₽",
  TRY: "₺",
  BTC: "₿",
  ETH: "Ξ",
  LTC: "Ł",
};

// Shared palette for hash-based coloring (unknown currencies, account icons, etc.)
export const HASH_PALETTE = [
  red[500],
  pink[500],
  purple[500],
  deepPurple[500],
  indigo[500],
  blue[500],
  lightBlue[500],
  cyan[500],
  teal[500],
  green[500],
  lightGreen[500],
  lime[500],
  yellow[600],
  amber[500],
  orange[500],
  deepOrange[500],
  brown[500],
  grey[600],
  blueGrey[500],
];

/**
 * Get a stable color for a string by hashing it into HASH_PALETTE.
 * Use for account icons, unknown currencies, or any string-based color.
 */
export function getColorFromHashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % HASH_PALETTE.length;
  return HASH_PALETTE[index];
}

/**
 * Get a color for a currency from the Material UI palette
 * @param currency - The currency code (e.g., "USD", "EUR")
 * @returns A hex color string from the Material UI palette
 */
export function getCurrencyColor(currency: string): string {
  if (CURRENCY_COLOR_MAP[currency]) {
    return CURRENCY_COLOR_MAP[currency];
  }
  return getColorFromHashString(currency);
}

export function getCurrencySymbol(currency: string): string | null {
  return CURRENCY_SYMBOL_MAP[currency] ?? null;
}

export function getCurrencyDisplayLabel(currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return symbol ? `${symbol} ${currency}` : `◌ ${currency}`;
}

export function getMappedCurrencies(): string[] {
  return Object.keys(CURRENCY_COLOR_MAP);
}

export function getCurrencyColorMap(): Record<string, string> {
  return { ...CURRENCY_COLOR_MAP };
}
