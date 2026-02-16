import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { fetchJSON } from "./api";

export interface BeanTabBalance {
  account: string;
  currency: string;
  date: string;
  number: number;
  type: string;
}

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
}

export function useBalances(): UseQueryResult<BalancesData> {
  const params = new URLSearchParams(location.search);
  const url = `balances?${params}`;

  return useQuery({
    queryKey: ['balances'],
    queryFn: () => fetchJSON<BalancesData>(url),
  });
}
