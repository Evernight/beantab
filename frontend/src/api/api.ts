export interface APIResponse<T> {
  success: boolean;
  error?: string;
  data: T;
}

export async function fetchJSON<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint);
  const json = (await response.json()) as APIResponse<T>;
  if (!response.ok || !json.success) {
    throw new Error(json.error || `HTTP error! status: ${response.status}`);
  }
  return json.data;
}

export async function postJSON<T>(endpoint: string, data: any): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const json = (await response.json()) as APIResponse<T>;
  if (!response.ok || !json.success) {
    throw new Error(json.error || `HTTP error! status: ${response.status}`);
  }
  return json.data;
}
