# Showroom — demo video brief

Everything a video maker needs to produce the demo video for the
**Manycore Aholo Global 3D AI Hackathon** submission (deadline **Thu Nov 19, 2026, 6:00 a.m. ET**).

- **Live site:** https://showroom-flax-two.vercel.app
- **Source:** https://github.com/yeziR4/showroom
- **Previous recording (old design, for reference only):** `docs/showroom-demo.mp4`
- **Project report:** `docs/Showroom - Showroom one photo to 3D product.pdf`

---

## 1. The project in one breath

**Showroom turns the product photos online sellers already have into real 3D models in about a minute, using Aholo Lux3D — then lets them spin the model, place it in a room with AR, and turn it into a 3D video ad.**

- **Who it's for:** small and mid-size online sellers (e.g. Shopify stores) who can't pay for 3D artists or product photoshoots — and their shoppers, who want to see a product from every side before buying.
- **How Lux3D is used (central to everything):**
  - **Image-to-3D (G1-Turbo)** — builds each product model from one photo.
  - **Text-to-3D** — "Idea → product" prototypes from a description.
  - **Material transfer** — colour variants without a new photoshoot.
- **What makes it memorable:** while Lux3D works, the photo dissolves into glowing particles (each particle is a pixel of the photo), inflates into a 3D shape, gets swept by scanning rings — then the particles burst away and the real Lux3D model lands in their place.

## 2. What the judges score (make the video serve this)

| Weight | Criterion | What the video must show |
|---|---|---|
| 30% | Use of Lux3D | Lux3D doing the core work, named on screen; a real build from a real photo |
| 25% | Fun & engagement | The particle scan → reveal moment; spinning the model; the ad studio |
| 20% | Innovation | Photo → 3D for e-commerce in a minute, with AR + video ads from the same model |
| 20% | Completeness | One complete, working journey with real timing; the product looks finished |
| 5% | Reach | A shareable cut for X (#Manycorehackathon) |

The rules require the video to **include actual footage of the demo running**. Editing, narration and captions are allowed.

## 3. Honesty rules — do not break these

Hackathon reviewers (including the Aholo team) already praised the honest timings. Keep it that way:

1. **Show one real build of a new photo**, start to finish. Don't use the "replay" examples as if they were live builds.
2. **Real timings only.** A build takes **about a minute** (our single builds measured **52–88 s, median ≈65 s**; the blue kettle took **61.7 s**, a ceramic dish **88.1 s**). Never say "instant" or "seconds".
3. **If you speed anything up, label it on screen** (e.g. a "2× speed" badge). The on-screen timer in the app always shows real elapsed time — keep it visible so speed-ups stay honest.
4. **Don't show fake data, fake reviews or invented numbers.** Facts you can use are in section 8.
5. **AR ("View in your room") only works on a real phone.** Record it on a phone, or don't claim it on screen.
6. **Product photos belong to their stores** — fine to show (every product links back to its store), but don't present them as our own products.

## 4. Practical recording notes

- **Record in a real browser with a GPU** (normal laptop/desktop Chrome). The 3D and particle effects are WebGL; headless/software-rendered browsers make them slow and make model loading look much longer than it is.
- **1920×1080 at 60 fps** if possible. Browser zoom 100%. Hide bookmarks bar and extensions.
- **First build of a photo costs ~1 Lux3D credit and takes ~1 minute.** The same photo uploaded again is recognised and the model is reused instantly — the app then honestly says *"Same photo as before · model reused"*, which is **not** a live build. So for the hero shot, **use a photo that hasn't been uploaded before** (a new product photo, or a fresh photo of something on your desk).
- **Daily limit:** the public site allows 40 builds per day in total and **8 per visitor (IP)**. Plan 2–3 takes at most.
- **Best photos:** one solid object, plain/white background, well lit (mugs, kettles, sneakers, cookware, toys, bottles). Avoid flat clothing, glass, thin straps, and photos of people.
- **Sharing is off by default.** If you want the new model to appear in the public showcase on camera, tick **"Share in the public showcase"** before dropping the photo. Optionally type a **Product name** first (it's what the showcase shows).
- **Let the page settle** for ~2 s after loading before recording a shot; the hero animation starts automatically.

### Where things are (for scripted/automated recording)

| Element | How to find it |
|---|---|
| Upload card | `.dropzone` (hidden file input: `input[type=file]`) |
| Product name field / share checkbox | `.upload-name input` / `.upload-share input` |
| Self-playing hero (photo → particles → model loop) | `.hero-stage` |
| Replay thumbnails ("built earlier") | `.replay-thumb` |
| Live build stage (particles, timer, steps) | `.build-stage` |
| "Spin one while you wait" example card | `.wait-card` (next example: `button[aria-label="Next example"]`) |
| After the reveal: actions | `.next-row` → "View in your room", "Make a 3D video ad", "Download GLB", "Build another" |
| Public showcase | `#showcase` |
| 3D store (good b-roll) | `/store/www.fellowproducts.com` — products on lit pedestals; drag to orbit, click a product |
| 3D mall search | `/explore` — search "kettle" or "sneakers" |
| Seller studio | `/studio?store=www.fellowproducts.com` → pick "Rebrew Stagg EKG Electric Kettle" |
| Ad studio | `/studio/ad?id=www.fellowproducts.com%2Frefurbished-stagg-ekg-electric-kettle` — pick Drop / Orbit, 9:16, press **Export video** |

## 5. Main video script (~90 seconds) — for the submission

Tone: confident, warm, clear. Cinematic but honest. Music: modern, light electronic, ~100–115 bpm.

| # | Time | Shot (on screen) | Narration (VO) | On-screen caption |
|---|---|---|---|---|
| 1 | 0:00–0:06 | Home page loads; the hero plays photo → particles → model by itself. Slow push-in on the hero stage. | "Every online seller has product photos. Almost none have 3D." | **Showroom** · powered by Aholo Lux3D |
| 2 | 0:06–0:12 | Cursor moves to the upload card; type a product name; drop a **new** product photo. | "Showroom changes that — with one photo." | 1 · Drop a product photo |
| 3 | 0:12–0:24 | The live build: photo dissolves into particles, inflates, scan rings sweep. Keep the **real timer** visible (top right of the stage). | "Aholo Lux3D starts building a real 3D model. Every particle is a pixel from the photo." | 2 · Lux3D builds it live — real timer |
| 4 | 0:24–0:40 | Scroll to the "spin one while you wait" card; drag to rotate an example; click → to the next one. **Mark 2× if sped up.** | "While it works, you can already explore products built earlier — fully interactive." | 3 · Spin an example while it builds |
| 5 | 0:40–0:52 | Back to the stage as the timer passes ~1:00; "Model ready"; particles burst; the model lands next to the photo. Hold on the timer value. | "About a minute later — the particles clear, and there's the real model." | 4 · Done in ~1 minute — the real 3D model |
| 6 | 0:52–1:02 | Drag to spin the model; zoom in on materials (metal, glaze, fabric). | "Real geometry, real materials. Not a picture — a 3D object." | Built from one photo |
| 7 | 1:02–1:12 | Ad studio: the model drops onto a gradient stage with price and "Shop now"; switch 9:16 → 1:1 → 16:9. | "The same model becomes a 3D video ad for TikTok, Reels or YouTube in one click." | 3D video ads |
| 8 | 1:12–1:20 | (Phone) "View in your room" — the product placed on a real table via AR. *If no phone footage: replace with the 3D store `/store/www.fellowproducts.com`, orbiting the pedestals.* | "Shoppers can place it in their own room." / or "and walk a whole store in 3D." | AR · or · 3D store |
| 9 | 1:20–1:30 | Showcase grid with the counter ("… products built in 3D so far"); end card: logo, URL, "Powered by Aholo Lux3D", #Manycorehackathon. | "Showroom. One product photo — a real 3D model, in about a minute." | showroom-flax-two.vercel.app · #Manycorehackathon |

## 6. Short cut for X (20–30 s, vertical 9:16 or square)

Hook in the first 2 seconds. No narration needed; big captions.

1. **0–3 s:** hero loop — photo → particles → model. Caption: *"One product photo…"*
2. **3–12 s:** drop a photo → particle scan with the timer (speed up 4–6× **with a visible "sped up" badge**). Caption: *"…Lux3D builds it in 3D (real time ~1 min)"*
3. **12–20 s:** reveal + spin. Caption: *"A real 3D model."*
4. **20–26 s:** ad studio export (9:16). Caption: *"Now it's a video ad."*
5. **26–30 s:** end card: logo + URL + *#Manycorehackathon*.

## 7. Deliverables

- **Main video:** MP4, H.264, 1080p, ~90 s (max 1 GB for the submission upload). Name: `Showroom - demo.mp4`.
- **X cut:** MP4, 1080×1920 (or 1080×1080), 20–30 s, captions burned in.
- **Thumbnail/cover:** a frame of the particle scan or the reveal, with "Photo → 3D in ~1 min".
- Use the brand: dark background, orange→pink gradient (#ffb547 → #ff6a2b → #ff2d78), headline font **Fraunces** (italic for accents), UI font **Inter**. Logo: `app/icon.svg` in the repo (a cube whose right face is made of particles).

## 8. Facts you can use (all verified)

- Build time: **about a minute**; single builds measured **52–88 s, median ≈65 s**; blue kettle **61.7 s**.
- Cost: **~1 Lux3D credit per model**.
- Lux3D features used: **image-to-3D (G1-Turbo / G1), text-to-3D, material transfer**; photos are uploaded to Aholo's asset storage first.
- Models: ~80k faces, PBR materials, GLB files viewable in any browser and in AR.
- **15** public Shopify stores searchable in the 3D mall; **18** models in the public showcase (it grows as people build).
- Ad studio: 4 camera moves (drop, reveal, orbit, spin), 3 formats (9:16, 1:1, 16:9), animated price/CTA, generated soundtrack.
- Also: Shopify push (3D media on product pages), embed code for any site, colourways.
- Built solo by **H (yeziR4)**.

Avoid claiming: "instant", "perfect", exact sales impact, user counts, or anything not listed here.

## 9. Known limitations (don't show these as successes)

- Printed text on packaging comes out blurry; thin flat parts (watch straps) can fail; translucent items may gain invented patterns. Pick solid objects for the hero shot.
- AR needs a phone (Android Scene Viewer / iPhone Quick Look).
