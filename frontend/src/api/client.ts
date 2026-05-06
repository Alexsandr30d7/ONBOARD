const API_PREFIX = "/api/v1";

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (typeof e === "object" && e && "msg" in e ? String((e as { msg: string }).msg) : JSON.stringify(e))).join("; ");
  return JSON.stringify(detail);
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (j.detail !== undefined) msg = formatErrorDetail(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<void> {
  const body = new URLSearchParams();
  body.set("username", username.trim().toLowerCase());
  body.set("password", password);
  const res = await fetch(`${API_PREFIX}/auth/token`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    let msg = "Ошибка входа";
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (j.detail !== undefined) msg = formatErrorDetail(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API_PREFIX}/auth/logout`, { method: "POST", credentials: "include" });
}

export async function apiPost(path: string, params?: Record<string, string | undefined>): Promise<void> {
  let url = `${API_PREFIX}${path}`;
  if (params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") q.set(k, v);
    }
    const s = q.toString();
    if (s) url += `?${s}`;
  }
  const res = await fetch(url, { method: "POST", credentials: "include" });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (j.detail !== undefined) msg = formatErrorDetail(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}
