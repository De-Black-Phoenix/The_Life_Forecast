const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
const adminTokenRaw = import.meta.env.VITE_ADMIN_TOKEN || "";
const adminToken = adminTokenRaw.trim();

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

  // If we are calling admin endpoints, require token up-front.
  if (path.startsWith("/admin") && !adminToken) {
    const error = new Error("unauthorized");
    (error as { status?: number }).status = 401;
    throw error;
  }

  const headers = new Headers(options.headers || {});

  if (adminToken) {
    // Send both forms; backend supports either.
    headers.set("Authorization", `Bearer ${adminToken}`);
    headers.set("X-Admin-Token", adminToken);
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
