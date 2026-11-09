import { NextResponse } from "next/server";

// Uploads, Lux3D calls and multi-store fetches can take a while on serverless.
export const maxDuration = 60;

// Pushes a generated GLB onto a product in the seller's own Shopify store as
// 3D media. Shopify then shows its native 3D viewer + AR button on the product page.
//
// Auth: an Admin API access token from a custom app on the seller's store
// (Settings → Apps → Develop apps → scopes: write_products, read_products).
// The token is used for this request only and never stored.
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-10";

async function gql<T>(shop: string, token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`Shopify: ${JSON.stringify(body.errors ?? body).slice(0, 300)}`);
  return body.data as T;
}

export async function POST(req: Request) {
  const { shop, token, handle, glb, title } = (await req.json()) as { shop: string; token: string; handle: string; glb: string; title: string };
  if (!shop || !token || !handle || !glb) return NextResponse.json({ error: "shop, token, handle and glb are required" }, { status: 400 });
  const shopDomain = shop.replace(/^https?:\/\//, "").split("/")[0];

  try {
    // 1. Find the product by handle.
    const found = await gql<{ products: { nodes: { id: string; title: string }[] } }>(shopDomain, token,
      `query($q: String!) { products(first: 1, query: $q) { nodes { id title } } }`, { q: `handle:${handle}` });
    const product = found.products.nodes[0];
    if (!product) throw new Error(`No product with handle "${handle}" in ${shopDomain}`);

    // 2. Download the GLB from Lux3D.
    const file = await fetch(glb);
    if (!file.ok) throw new Error("Could not download the 3D model");
    const bytes = new Uint8Array(await file.arrayBuffer());

    // 3. Ask Shopify for a staged upload target and upload the GLB there.
    const staged = await gql<{ stagedUploadsCreate: { stagedTargets: { url: string; resourceUrl: string; parameters: { name: string; value: string }[] }[]; userErrors: { message: string }[] } }>(
      shopDomain, token,
      `mutation($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { message } } }`,
      { input: [{ filename: `${handle}.glb`, mimeType: "model/gltf-binary", resource: "MODEL_3D", fileSize: String(bytes.byteLength), httpMethod: "POST" }] });
    if (staged.stagedUploadsCreate.userErrors.length) throw new Error(staged.stagedUploadsCreate.userErrors[0].message);
    const target = staged.stagedUploadsCreate.stagedTargets[0];
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append("file", new Blob([bytes], { type: "model/gltf-binary" }), `${handle}.glb`);
    const up = await fetch(target.url, { method: "POST", body: form });
    if (!up.ok) throw new Error(`Staged upload failed (${up.status})`);

    // 4. Attach it to the product as 3D media.
    const res = await gql<{ productUpdate: { userErrors: { message: string }[] } }>(shopDomain, token,
      `mutation($product: ProductUpdateInput!, $media: [CreateMediaInput!]) { productUpdate(product: $product, media: $media) { userErrors { message } } }`,
      { product: { id: product.id }, media: [{ originalSource: target.resourceUrl, mediaContentType: "MODEL_3D", alt: `${title} — 3D model by Showroom (Lux3D)` }] });
    if (res.productUpdate.userErrors.length) throw new Error(res.productUpdate.userErrors[0].message);

    return NextResponse.json({ ok: true, product: product.title, admin: `https://${shopDomain}/admin/products/${product.id.split("/").pop()}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
