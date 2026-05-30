export interface AccountDelta {
  assetsPositive: number;
  liabilitiesPositive: number;
  expensesPositive: number;
  incomePositive: number;
  assetsNegative: number;
  liabilitiesNegative: number;
  expensesNegative: number;
  incomeNegative: number;
  padPositive: number;
  padNegative: number;
}

export interface AccountDeltaCell {
  native: AccountDelta;
  converted: AccountDelta | null;
}
