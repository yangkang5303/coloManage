const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const TOKEN_KEY = "colo_api_token";

function getTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setTokenToStorage(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

async function getToken(): Promise<string | null> {
  // Try localStorage first
  const stored = getTokenFromStorage();
  if (stored) return stored;

  // Auto-login
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "admin123" }),
    });
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    const token = (data.access_token as string) || "";
    if (token) setTokenToStorage(token);
    return token;
  } catch {
    return null;
  }
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>) || {},
  };
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (res.status === 401) {
    // Token expired or invalid — clear it and redirect to login
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      const currentPath = window.location.pathname;
      if (currentPath !== "/login") {
        window.location.href = "/login";
      }
    }
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) {
    const err = await res.text().catch(() => "Request failed");
    throw new Error(err);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;
}

export async function apiGet(path: string) {
  return request(path, { method: "GET" });
}

export async function apiPost(path: string, body: any, isFormData = false) {
  if (isFormData) {
    return request(path, {
      method: "POST",
      body,
    });
  }
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiPut(path: string, body: any) {
  return request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiDelete(path: string) {
  return request(path, { method: "DELETE" });
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  const data = await res.json();
  // Cache token after login
  if (data.access_token) setTokenToStorage(data.access_token);
  return data;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}