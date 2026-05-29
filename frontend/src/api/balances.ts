import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { fetchJSON } from "./api";

export interface BeanTabBalance {
  account: string;
  currency: string;
  date: string;
  number: number;
  type: string;
  filename?: string;
  lineno?: number;
}

export type BalanceSourceLocation = {
  filename: string;
  lineno: number;
};

export interface BeanTabAccount {
  account: string;
  defaultBalanceType: string;
  /** Currencies from Open directive (or from balances when not declared) */
  currencies: string[];
}

export interface BalanceErrorItem {
  account: string;
  date: string;
  currency: string;
  message: string;
}

export interface BalancesData {
  balances: BeanTabBalance[];
  accounts: BeanTabAccount[];
  balanceErrors?: BalanceErrorItem[];
  /** Operating currencies from ledger options */
  operatingCurrencies?: string[];
}

export function useBalances(): UseQueryResult<BalancesData> {
  const params = new URLSearchParams(location.search);
  const url = `balances?${params}`;

  return useQuery({
    queryKey: ['balances'],
    queryFn: () => fetchJSON<BalancesData>(url),
  });
}
