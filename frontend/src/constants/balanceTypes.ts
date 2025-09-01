/**
 * Balance type display config and symbols (longest-first for parsing).
 * Used by the grid for display and by the store when parsing/saving cell values.
 */
export const BALANCE_TYPE_DISPLAY_MAPPING: Record<string, { symbol: string; color: string }> = {
  regular: { symbol: "!", color: "#00897b" },
  full: { symbol: "F", color: "rgb(30, 136, 229)" },
  padded: { symbol: "~", color: "#546e7a" },
  "full-padded": { symbol: "F~", color: "rgb(30, 136, 229)" },
  valuation: { symbol: "V", color: "rgb(30, 136, 229)" },
};

export const BALANCE_TYPE_SYMBOLS = Object.entries(BALANCE_TYPE_DISPLAY_MAPPING)
  .map(([key, { symbol, color }]) => ({ key, symbol, color }))
  .sort((a, b) => b.symbol.length - a.symbol.length);
