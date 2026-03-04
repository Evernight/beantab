import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { fetchJSON } from "./api";

export interface AccountPosting {
  date: string;
  account: string;
  units: {
    number: number;
    currency: string;
  };
}

export interface PostingsData {
  postings: AccountPosting[];
}

export function usePostings(
  targetCurrency: string,
  options?: { enabled?: boolean }
): UseQueryResult<PostingsData> {
  const params = new URLSearchParams(location.search);
  params.set("target_currency", targetCurrency);
  const url = `postings?${params}`;

  const enabled = options?.enabled ?? targetCurrency.length > 0;

  return useQuery({
    queryKey: ["postings", targetCurrency],
    queryFn: () => fetchJSON<PostingsData>(url),
    enabled: enabled && targetCurrency.length > 0,
  });
}
