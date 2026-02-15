type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiError extends Error {
  status?: number;
  payload?: unknown;
}

export async function apiRequest<T = any>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res
    .clone()
    .json()
    .catch(() => undefined);

  if (!res.ok) {
    const error: ApiError = new Error((data as any)?.message || "Request failed");
    error.status = res.status;
    error.payload = data;
    throw error;
  }

  return (data as T) ?? ({} as T);
}
