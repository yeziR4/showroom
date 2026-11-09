// Minimal Upstash Redis REST client. Configured by the Vercel Upstash integration
// (KV_REST_API_* or UPSTASH_REDIS_REST_*). Every helper is a no-op without it.
const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

export const hasRedis = Boolean(URL_ && TOKEN);

export async function redis<T>(cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const body = (await res.json()) as { result?: T; error?: string };
  if (body.error) throw new Error(`Redis: ${body.error}`);
  return body.result as T;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!hasRedis) return null;
  try {
    const v = await redis<string | null>(["GET", key]);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  if (!hasRedis) return;
  try {
    await redis(["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
  } catch {
    /* cache is best-effort */
  }
}
