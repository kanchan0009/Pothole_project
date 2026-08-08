import axios from 'axios';

/** Base API URL. Dev uses the Vite proxy (/api → http://localhost:5000). */
export const API_URL = import.meta.env.VITE_API_URL || '/api';

/** LocalStorage keys for the auth session. */
export const STORAGE_KEYS = {
  access: 'rg_access',
  refresh: 'rg_refresh',
  user: 'rg_user',
} as const;

/**
 * Shared Axios instance.
 * - Attaches the access token to every request.
 * - Unwraps the API's `{ success, data }` envelope (so consumers get `data`).
 * - On 401, attempts a single refresh-token rotation before giving up.
 */
export const apiClient = axios.create({ baseURL: API_URL });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.access);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refresh);
  if (!refreshToken) return null;

  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const data = res.data?.data;
    localStorage.setItem(STORAGE_KEYS.access, data.token);
    localStorage.setItem(STORAGE_KEYS.refresh, data.refreshToken);
    return data.token as string;
  } catch {
    localStorage.removeItem(STORAGE_KEYS.access);
    localStorage.removeItem(STORAGE_KEYS.refresh);
    localStorage.removeItem(STORAGE_KEYS.user);
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => {
    // Unwrap { success, data } envelope for JSON responses.
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      return response.data.data as typeof response.data;
    }
    return response.data as typeof response.data;
  },
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }
    const message =
      error.response?.data?.error?.message || error.message || 'Unexpected error. Please try again.';
    // Attach the structured error envelope so callers can react to codes
    // like DUPLICATE_REPORT without re-parsing the original Axios error.
    const rejected = new Error(message);
    (rejected as Error & { responseData?: unknown }).responseData = error.response?.data?.error;
    return Promise.reject(rejected);
  }
);

/** Convenience: typed wrapper for endpoints that return `{ data }`. */
export const unwrap = <T,>(promise: Promise<unknown>): Promise<T> => promise as Promise<T>;
