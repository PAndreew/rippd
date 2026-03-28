export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

const AUTH_TOKEN_KEY = 'rippd:auth-token';

function inferApiBaseUrl() {
  const serverUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? 'ws://localhost:3001';
  if (serverUrl.startsWith('ws://')) return serverUrl.replace('ws://', 'http://');
  if (serverUrl.startsWith('wss://')) return serverUrl.replace('wss://', 'https://');
  return serverUrl;
}

export const API_BASE_URL = inferApiBaseUrl();

export function getStoredAuthToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
}

export function storeAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredAuthToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
  const token = getStoredAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  const json = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(json.error ?? 'Request failed');
  return json;
}

export async function registerAccount(input: { email: string; password: string; displayName: string }) {
  return request<{ token: string; user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function loginAccount(input: { email: string; password: string }) {
  return request<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function fetchCurrentUser() {
  return request<{ user: AuthUser }>('/auth/me');
}
