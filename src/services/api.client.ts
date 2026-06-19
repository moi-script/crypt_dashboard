/**
 * api.client — thin fetch wrapper around the crypto-dashboard REST API.
 *
 * Responsibilities:
 *  - prefix requests with the API base URL
 *  - attach the JWT access token as a Bearer header
 *  - transparently refresh + retry once on a 401
 *  - surface a typed ApiError for HTTP failures and NetworkError when the
 *    backend is unreachable (so services can fall back to demo data)
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

  // export const API_URL =
  // process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, "") ||
  API_URL.replace(/^http/, "ws");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message);
    this.name = "NetworkError";
  }
}

/* ── Token store ──────────────────────────────────────────────────────────── */

const ACCESS_KEY = "cd.access";
const REFRESH_KEY = "cd.refresh";

let accessToken: string | null = null;

export const tokenStore = {
  get access() {
    if (accessToken) return accessToken;
    if (typeof window !== "undefined") accessToken = localStorage.getItem(ACCESS_KEY);
    return accessToken;
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    accessToken = tokens.accessToken;
    if (typeof window !== "undefined") {
      localStorage.setItem(ACCESS_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    }
  },
  clear() {
    accessToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    }
  },
};

/* ── Demo mode signal ─────────────────────────────────────────────────────────
   Flips on the first time the live API can't be reached so the UI can show a
   "DEMO DATA" indicator while still rendering a fully interactive experience. */

let demo = process.env.NEXT_PUBLIC_MOCKS === "1";
const demoListeners = new Set<(v: boolean) => void>();

export const demoMode = {
  get value() {
    return demo;
  },
  enable() {
    if (!demo) {
      demo = true;
      demoListeners.forEach((l) => l(true));
    }
  },
  subscribe(fn: (v: boolean) => void) {
    demoListeners.add(fn);
    return () => demoListeners.delete(fn);
  },
};

/* ── Core request ─────────────────────────────────────────────────────────── */

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function raw<T>(
  method: Method,
  path: string,
  body?: unknown,
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.access;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  // Refresh-and-retry once on an expired access token.
  if (res.status === 401 && retry && tokenStore.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) return raw<T>(method, path, body, false);
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : typeof payload === "string"
          ? payload
          : res.statusText) || "Request failed";
    throw new ApiError(res.status, message);
  }

  return payload as T;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      tokenStore.clear();
      if (typeof window !== "undefined") window.location.replace("/login");
      return false;
    }
    const tokens = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    tokenStore.set(tokens);
    return true;
  } catch {
    return false;
  }
}

export const apiClient = {
  get: <T>(path: string) => raw<T>("GET", path),
  post: <T>(path: string, body?: unknown) => raw<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => raw<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => raw<T>("PATCH", path, body),
  del: <T>(path: string) => raw<T>("DELETE", path),
};

/**
 * Run a live API call, but fall back to a demo value when the backend is
 * unreachable. HTTP errors (4xx/5xx) are NOT swallowed — only true network
 * failures trigger the fallback.
 */
export async function withFallback<T>(
  live: () => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  try {
    return await live();
  } catch (err) {
    if (err instanceof NetworkError) {
      demoMode.enable();
      return fallback();
    }
    throw err;
  }
}
