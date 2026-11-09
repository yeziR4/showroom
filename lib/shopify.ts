import { cacheGet, cacheSet } from "./redis";

// Reads any public Shopify storefront through its /products.json feed.
// No login is needed: every Shopify store publishes this feed unless the
// storefront is password-protected.

export type Product = {
  id: string; // `${domain}/${handle}` — stable key across the app
  domain: string;
  handle: string;
  title: string;
  vendor: string;
  type: string;
  price: string;
  currency?: string;
  images: string[];
  url: string;
  tags: string[];
};

export type Store = {
  domain: string;
  name: string;
  products: Product[];
};

// Public stores verified to serve /products.json. Used to seed the mall and
// cross-store product search.
export const SEED_STORES = [
  "allbirds.com",
  "kith.com",
  "www.brooklinen.com",
  "www.fellowproducts.com",
  "www.ridgewallet.com",
  "www.deathwishcoffee.com",
  "www.ugmonk.com",
  "www.burrow.com",
  "www.nativecos.com",
  "www.ember.com",
  "www.parachutehome.com",
  "www.misen.com",
  "www.greatjonesgoods.com",
  "www.mvmt.com",
  "www.loopearplugs.com",
];

export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").split("/")[0].split("?")[0];
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return s;
}

type RawProduct = {
  handle: string;
  title: string;
  vendor: string;
  product_type: string;
  tags: string[] | string;
  variants: { price: string }[];
  images: { src: string }[];
};

const cache = new Map<string, { at: number; store: Store }>();
const TTL = 30 * 60 * 1000;

async function fetchFeed(domain: string): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://${domain}/products.json?limit=250`, {
        headers: { Accept: "application/json", "User-Agent": "Showroom3D/0.1" },
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok || (res.status !== 429 && res.status < 500)) return res;
      last = res;
    } catch {
      /* network error or timeout — retry */
    }
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  if (last) return last;
  throw new Error(`${domain} did not respond`);
}

export async function fetchStore(rawDomain: string): Promise<Store> {
  const domain = normalizeDomain(rawDomain);
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < TTL) return hit.store;
  // Shared cache across serverless instances, so search doesn't refetch 15 feeds.
  const shared = await cacheGet<Store>(`showroom:store:${domain}`);
  if (shared) {
    cache.set(domain, { at: Date.now(), store: shared });
    return shared;
  }

  const res = await fetchFeed(domain);
  if (!res.ok) throw new Error(`${domain} did not return a product feed (HTTP ${res.status})`);
  let raw: { products: RawProduct[] };
  try {
    raw = await res.json();
  } catch {
    throw new Error(`${domain} does not look like a public Shopify store`);
  }

  const products: Product[] = raw.products
    .filter((p) => p.images?.length)
    .map((p) => ({
      id: `${domain}/${p.handle}`,
      domain,
      handle: p.handle,
      title: p.title,
      vendor: p.vendor,
      type: p.product_type,
      price: p.variants?.[0]?.price ?? "",
      images: p.images.map((i) => i.src),
      url: `https://${domain}/products/${p.handle}`,
      tags: Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(",").map((t) => t.trim()),
    }));

  const store: Store = { domain, name: prettyName(domain), products };
  cache.set(domain, { at: Date.now(), store });
  await cacheSet(`showroom:store:${domain}`, store, 3600);
  return store;
}

const NAMES: Record<string, string> = {
  "www.fellowproducts.com": "Fellow", "www.ridgewallet.com": "Ridge", "www.deathwishcoffee.com": "Death Wish Coffee",
  "www.nativecos.com": "Native", "www.parachutehome.com": "Parachute", "www.greatjonesgoods.com": "Great Jones",
  "www.loopearplugs.com": "Loop", "www.mvmt.com": "MVMT", "www.ugmonk.com": "Ugmonk",
};

export function prettyName(domain: string): string {
  if (NAMES[domain]) return NAMES[domain];
  const base = domain.replace(/^www\./, "").replace(/\.myshopify\.com$/, "").split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function searchProducts(query: string, limit = 60): Promise<Product[]> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const stores = await Promise.allSettled(SEED_STORES.map((d) => fetchStore(d)));
  const scored: { p: Product; score: number }[] = [];
  for (const s of stores) {
    if (s.status !== "fulfilled") continue;
    for (const p of s.value.products) {
      const hay = `${p.title} ${p.type} ${p.vendor} ${p.tags.join(" ")}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (p.title.toLowerCase().includes(t)) score += 3;
        else if (hay.includes(t)) score += 1;
        else {
          score = -1;
          break;
        }
      }
      if (score > 0) scored.push({ p, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.p);
}
