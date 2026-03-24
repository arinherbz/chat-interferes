type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiError extends Error {
  status?: number;
  payload?: unknown;
}

const getCache = new Map<string, { data: unknown; ts: number }>();
const inFlight = new Map<string, Promise<unknown>>();
const GET_TTL_MS = 30_000;
const AUTH_ME_PATH = "/api/auth/me";

type ApiRequestOptions = {
  cacheTtlMs?: number;
  skipCache?: boolean;
  idempotencyKey?: string;
};

export async function apiRequest<T = any>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const requestKey = `${method}:${path}:${JSON.stringify(body ?? null)}`;
  const now = Date.now();
  const shouldCacheGet = method === "GET" && !options.skipCache && path !== AUTH_ME_PATH;

  if (shouldCacheGet) {
    const cached = getCache.get(requestKey);
    const ttl = options.cacheTtlMs ?? GET_TTL_MS;
    if (cached && now - cached.ts <= ttl) {
      return cached.data as T;
    }
  }

  if (inFlight.has(requestKey)) {
    return inFlight.get(requestKey) as Promise<T>;
  }

  const run = (async () => {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res
    .clone()
    .json()
    .catch(() => undefined);

  if (!res.ok) {
    const message = (data as any)?.message || (data as any)?.error || "Request failed";
    const error: ApiError = new Error(message);
    error.status = res.status;
    error.payload = data;
    throw error;
  }

    const parsed = (data as T) ?? ({} as T);
    if (shouldCacheGet) {
      getCache.set(requestKey, { data: parsed, ts: Date.now() });
    } else {
      // write-through invalidation for matching GET endpoint
      const getPrefix = `GET:${path}:`;
      for (const key of Array.from(getCache.keys())) {
        if (key.startsWith(getPrefix)) getCache.delete(key);
      }
    }
    return parsed;
  })();

  inFlight.set(requestKey, run);
  try {
    return await run;
  } finally {
    inFlight.delete(requestKey);
  }
}

export function clearApiCache(match?: string | RegExp) {
  if (!match) {
    getCache.clear();
    inFlight.clear();
    return;
  }

  for (const key of Array.from(getCache.keys())) {
    const matches = typeof match === "string" ? key.includes(match) : match.test(key);
    if (matches) getCache.delete(key);
  }

  for (const key of Array.from(inFlight.keys())) {
    const matches = typeof match === "string" ? key.includes(match) : match.test(key);
    if (matches) inFlight.delete(key);
  }
}
