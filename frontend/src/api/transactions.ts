import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { fetchJSON } from "./api";

export interface AccountPosting {
  account: string;
  units: {
    number: number;
    currency: string;
  };
}

export interface Transaction {
  date: string;
  postings: AccountPosting[];
}

export interface TransactionsData {
  transactions: Transaction[];
}

export function useTransactions(
  targetCurrency: string,
  options?: { enabled?: boolean }
): UseQueryResult<TransactionsData> {
  const params = new URLSearchParams(location.search);
  params.set("target_currency", targetCurrency);
  const url = `transactions?${params}`;

  const enabled = options?.enabled ?? targetCurrency.length > 0;

  return useQuery({
    queryKey: ["transactions", targetCurrency],
    queryFn: () => fetchJSON<TransactionsData>(url),
    enabled: enabled && targetCurrency.length > 0,
  });
}
