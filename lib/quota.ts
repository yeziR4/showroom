// Protects Aholo credits on the public site: caps how many Lux3D tasks can be
// started per day, in total and per visitor. Viewing existing models is free.
import { hasRedis, redis } from "./redis";

const SITE_LIMIT = Number(process.env.DAILY_BUILD_LIMIT ?? 40);
const VISITOR_LIMIT = Number(process.env.DAILY_BUILDS_PER_VISITOR ?? 8);

const mem = new Map<string, number>();

function day() {
  return new Date().toISOString().slice(0, 10);
}

async function incr(key: string): Promise<number> {
  if (hasRedis) {
    const n = await redis<number>(["INCR", key]);
    if (n === 1) await redis(["EXPIRE", key, 60 * 60 * 26]);
    return n;
  }
  const n = (mem.get(key) ?? 0) + 1;
  mem.set(key, n);
  return n;
}

async function get(key: string): Promise<number> {
  if (hasRedis) return Number((await redis<string | null>(["GET", key])) ?? 0);
  return mem.get(key) ?? 0;
}

export function visitorId(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

export class QuotaError extends Error {}

// Call right before starting a Lux3D task. Throws QuotaError when over the limit.
export async function spendBuild(req: Request) {
  const d = day();
  const site = await incr(`showroom:builds:${d}`);
  if (site > SITE_LIMIT) {
    throw new QuotaError(`Today's ${SITE_LIMIT} free 3D builds are used up. Try again tomorrow, or browse the products already in 3D.`);
  }
  const visitor = await incr(`showroom:builds:${d}:${visitorId(req)}`);
  if (visitor > VISITOR_LIMIT) {
    throw new QuotaError(`You've used your ${VISITOR_LIMIT} free 3D builds for today. Come back tomorrow!`);
  }
}

export async function quotaStatus(req: Request) {
  const d = day();
  const [site, visitor] = await Promise.all([get(`showroom:builds:${d}`), get(`showroom:builds:${d}:${visitorId(req)}`)]);
  return {
    siteUsed: site, siteLimit: SITE_LIMIT,
    visitorUsed: visitor, visitorLimit: VISITOR_LIMIT,
    remaining: Math.max(0, Math.min(SITE_LIMIT - site, VISITOR_LIMIT - visitor)),
  };
}
