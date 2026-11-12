# Showroom — every product in 3D

Paste a Shopify store link and **Aholo Lux3D** turns its product photos into textured 3D models.
On top of those models, Showroom gives sellers AR try-on, one-click 3D video ads and colour
variants, and gives shoppers a 3D mall where they can search any store or product.

Built for the Manycore Aholo Global 3D AI Hackathon.

## What's in it

| Page | What it does |
|---|---|
| `/` | Landing with the two entry points: sellers and shoppers |
| `/explore` | The 3D mall: search products across stores, or open a store |
| `/store/[domain]` | A store's 3D showroom (products on pedestals) plus its catalogue |
| `/studio` | Seller studio: load a store, bulk-build 3D, then per product: AR, ad, colourways, embed code, push to Shopify. Also "Idea → product" (text-to-3D) |
| `/studio/ad` | 3D ad studio: 4 camera motions, 3 formats (9:16, 1:1, 16:9), themes, animated text, soundtrack, exports a video file |

## Aholo / Lux3D features used

- **Image-to-3D** (G1-Turbo / G1, 1–4 product photos) — every product model
- **Text-to-3D** — Idea → product prototypes
- **Material transfer** — colour / material variants (GLB + USDZ)
- **Asset upload (OUS)** — product photos are copied into Aholo storage first, because Lux3D can't fetch images from Shopify's CDN

## Run it

```bash
npm install
cp .env.example .env.local   # then put your Aholo Global API key in it
npm run dev
```

Open http://localhost:3000.

## Deploy on Vercel

1. Import this repo at vercel.com/new (framework: Next.js, no settings to change).
2. Add the environment variable `AHOLO_API_KEY`.
3. Optional but recommended: Storage → add **Upstash Redis** to the project. It sets
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`), and newly built
   models are then saved and shown to every visitor. Without it the demo catalogue
   still works, but new models are only kept in the visitor's session.

### Credit protection

Every Lux3D build costs credits, so the public site caps builds per day
(viewing existing models is always free). Override with environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `DAILY_BUILD_LIMIT` | 40 | Builds per day across the whole site |
| `DAILY_BUILDS_PER_VISITOR` | 8 | Builds per day per visitor (by IP) |

The counters live in Redis when it is connected.

### Public showcase

Every model built on the site (store products, text prompts and visitors' uploaded
photos) appears in the landing-page showcase, newest first. Visitors can untick
"Add my model to the public showcase" before uploading. To take something down,
set `ADMIN_KEY` in Vercel and open:

```
https://<your-site>/api/admin/hide?id=<model id>&key=<ADMIN_KEY>
```

Add `&undo=1` to bring it back. Model ids are in `/api/models`.

## Deploy on ModelScope Studio (reachable from mainland China)

`*.vercel.app` is blocked in mainland China, so the same app also ships as a
Docker image for a ModelScope **Docker Studio**. The app has no runtime
dependency on Google or jsDelivr: fonts and the `<model-viewer>` script are
served from the app itself, and the image is built from ModelScope's base image
with Node and npm packages from npmmirror.

1. On modelscope.cn: bind an Alibaba Cloud account with real-name verification
   (required for Docker Studios), then create a Studio with SDK **Docker**.
2. Push this repository to the Studio's git repo (it builds `Dockerfile`).
3. In the Studio's Settings → environment variables, add `AHOLO_API_KEY`, and
   optionally `KV_REST_API_URL` + `KV_REST_API_TOKEN` (same Upstash Redis as
   Vercel, so both sites share one showcase) and `ADMIN_KEY`.
4. Launch. The app listens on port 7860 and keeps its data in `/mnt/workspace`.

## How it works

1. `lib/shopify.ts` reads a store's public `/products.json` feed.
2. `lib/lux3d.ts` downloads the product photo, uploads it to Aholo storage, starts a Lux3D task and polls it.
3. `lib/models.ts` keeps one record per product so nothing is generated twice.
   `data/catalog.json` holds pre-generated demo models; new records go to Upstash Redis
   in production or `data/cache.json` locally.
4. The browser loads the GLB files straight from Lux3D's CDN (CORS is open) with
   `<model-viewer>` (AR included) and react-three-fiber (showroom and ad renderer).
5. The ad studio renders the 3D scene off-screen, composites text and a synthesized
   soundtrack on a 2D canvas, and records it with `MediaRecorder`.

Products and photos belong to their stores; every product links back to its store.
