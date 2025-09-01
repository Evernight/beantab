import { fetchJSON, postJSON } from "./api";

export interface SafetyCheckResponse {
  ok: boolean;
  reason?: string;
}

export async function safetyCheck(): Promise<SafetyCheckResponse> {
  return fetchJSON<SafetyCheckResponse>("safety_check");
}

export async function reloadLedger(): Promise<{ reloaded: boolean }> {
  return fetchJSON<{ reloaded: boolean }>("reload");
}

interface ModifiedCell {
  account: string;
  currency: string;
  date: string;
  originalValue: string | number | null;
  newValue: string | number | null;
  /** Balance type when user entered a modifier (~ or !). e.g. "padded", "regular", "full-padded" */
  balanceType?: string;
}

interface SaveResponse {
  message: string;
  changes: ModifiedCell[];
}

export async function saveModifiedCells(modifiedCells: ModifiedCell[]): Promise<SaveResponse> {
  return postJSON<SaveResponse>("updateBalances", {
    modifiedCells,
  });
}
