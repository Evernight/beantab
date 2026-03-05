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
  narration?: string;
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
  if (targetCurrency.length > 0) {
    params.set("target_currency", targetCurrency);
  }
  const url = params.toString() ? `transactions?${params}` : "transactions";

  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ["transactions", targetCurrency],
    queryFn: () => fetchJSON<TransactionsData>(url),
    enabled,
  });
}
