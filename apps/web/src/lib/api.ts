export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface ApiError {
  error: string;
}

const SESSION_TOKEN_KEY = "sessionToken";

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

function buildAuthorizedHeaders(init?: RequestInit): Headers {
  const token = getSessionToken();
  const headers = new Headers(init?.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = buildAuthorizedHeaders(init);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "Request failed" }))) as ApiError;
    throw new Error(payload.error || "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiFetchText(path: string, init?: RequestInit): Promise<string> {
  const headers = buildAuthorizedHeaders(init);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "Request failed" }))) as ApiError;
    throw new Error(payload.error || "Request failed");
  }

  return response.text();
}
