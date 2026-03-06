import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { postJSON } from "./api";

export interface EstimatedBalance {
  account: string;
  currency: string;
  date: string;
  number: number;
}

export interface EstimatedBalancesData {
  estimatedBalances: EstimatedBalance[];
}

export function useEstimatedBalances(
  dates: string[],
  options?: { enabled?: boolean }
): UseQueryResult<EstimatedBalancesData> {
  const enabled = (options?.enabled ?? true) && dates.length > 0;

  return useQuery({
    queryKey: ["estimatedBalances", dates],
    queryFn: () =>
      postJSON<EstimatedBalancesData>("estimated_balances", { dates }),
    enabled,
  });
}
