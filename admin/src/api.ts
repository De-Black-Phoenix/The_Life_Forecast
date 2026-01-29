const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
const adminTokenRaw = import.meta.env.VITE_ADMIN_TOKEN || "";
const adminToken = adminTokenRaw.trim();
const authStorageKey = "life_forecast_admin_jwt";

export function getStoredJwt(): string {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem(authStorageKey) || "").trim();
  } catch {
    return "";
  }
}

export function setStoredJwt(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(authStorageKey, token);
}

export function clearStoredJwt() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(authStorageKey);
}

export function getAuthToken(): string {
  const jwt = getStoredJwt();
  return jwt || adminToken;
}

export function getApiConfig() {
  return { apiBaseUrl, adminToken };
}

export async function fetchJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error("missing_api_base_url");
  }

  const authToken = getAuthToken();

  // If we are calling admin endpoints, require token up-front.
  if (path.startsWith("/admin") && !authToken) {
    const error = new Error("unauthorized");
    (error as { status?: number }).status = 401;
    throw error;
  }

  const headers = new Headers(options.headers || {});

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
    if (adminToken && authToken === adminToken) {
      headers.set("X-Admin-Token", adminToken);
    }
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    const error = new Error("unauthorized");
    (error as { status?: number }).status = response.status;
    throw error;
  }

  if (!response.ok) {
    throw new Error("api_error");
  }

  return response.json() as Promise<T>;
}

export function normalizeArrayResponse<T>(
  payload: unknown,
  keys: string[]
): { items: T[]; unexpected: boolean } {
  if (payload && typeof payload === "object") {
    for (const key of keys) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return { items: value as T[], unexpected: false };
      }
    }
  }
  return { items: [], unexpected: true };
}
