import { blue, green, lime, pink, purple, teal } from "@mui/material/colors";
import type { AccountDelta } from "../types/deltas";

export const DELTA_KEY_LABEL: Record<keyof AccountDelta, string> = {
  assetsPositive: "Assets (Transfers Out)",
  assetsNegative: "Assets (Transfers In)",
  liabilitiesPositive: "Liabilities (Transfers Out)",
  liabilitiesNegative: "Liabilities (Transfers In)",
  expensesPositive: "Expenses",
  expensesNegative: "Expenses (Negative)",
  incomePositive: "Income (Positive)",
  incomeNegative: "Income",
  padPositive: "Padding (Positive)",
  padNegative: "Padding (Negative)",
};

export const DELTA_KEY_LABEL_SHORT: Record<keyof AccountDelta, string> = {
  assetsPositive: "Assets (OUT)",
  assetsNegative: "Assets (IN)",
  liabilitiesPositive: "Liab (OUT)",
  liabilitiesNegative: "Liab (IN)",
  expensesPositive: "Expenses +",
  expensesNegative: "Expenses -",
  incomePositive: "Income +",
  incomeNegative: "Income -",
  padPositive: "Pad +",
  padNegative: "Pad -",
};

export const DELTA_NEGATIVE: { key: keyof AccountDelta; color: string; textColor: string }[] = [
  { key: "assetsNegative", color: blue[300], textColor: blue[700] },
  { key: "liabilitiesNegative", color: teal[300], textColor: teal[700] },
  { key: "expensesNegative", color: lime[200], textColor: lime[800] },
  { key: "incomeNegative", color: green[300], textColor: green[700] },
  { key: "padNegative", color: purple[300], textColor: purple[700] },
];

export const DELTA_POSITIVE: { key: keyof AccountDelta; color: string; textColor: string }[] = [
  { key: "assetsPositive", color: blue[600], textColor: blue[900] },
  { key: "liabilitiesPositive", color: teal[500], textColor: teal[900] },
  { key: "expensesPositive", color: lime[600], textColor: lime[900] },
  { key: "incomePositive", color: green[600], textColor: green[900] },
  { key: "padPositive", color: purple[600], textColor: purple[900] },
];
