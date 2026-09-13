# Anti-xor

A scroll-driven landing page for a **premium car-rental concept brand**. The hero
car is not a picture — it is a car built out of maths at page load (WebGL), lit by
a hand-written shader, and turned a full 360° by the scroll position.

> **This is a concept site.** The vehicles, prices, testimonials and booking form
> are samples shown for layout. Nothing on the page takes a real booking or a
> real payment.

**Live:** https://anti-xor.pages.dev

---

## What is in the repo

```
public/                 everything that ships — and nothing else
  index.html            the whole page (six "acts", one scroll)
  404.html
  css/site.css          all styling, including the reduced-motion fallback
  js/scene.js           skyline generator + WebGL car + the scroll score
  assets/og.png         1200×630 social preview card
  assets/apple-touch-icon.png
  favicon.svg
  robots.txt            points crawlers at the sitemap
  sitemap.xml
  site.webmanifest
  _headers              security headers, CSP and cache rules for Cloudflare
wrangler.toml           Cloudflare Pages project config
package.json            two scripts: dev and deploy
```

`public/` exists on purpose. `wrangler pages deploy` uploads *everything* in the
directory you point it at, so the site lives in its own folder and the README,
the tooling and `.git` are structurally incapable of ending up on the internet.

## How the page works

The page is one document divided into six sections, each with a job:

| Act | Section | Technique |
| --- | --- | --- |
| 1 | Hero | four background planes at different parallax speeds |
| 2 | The turn | the WebGL car spins 360° scrubbed by scroll |
| 3 | Fleet | a horizontal track panned in 3D as you scroll down |
| 4 | Proof | a clip-path wipe plus staggered feature reveals |
| 5 | Voices | pointer-tracked card tilt |
| 6 | Book | the search bar and footer |

`js/scene.js` runs a single `requestAnimationFrame` loop. It reads
`window.scrollY` once per frame, converts it into a progress value per section,
and interpolates towards the target values — so the car eases instead of
snapping. The canvas hides itself once act 2 has scrolled past, so the GPU is
idle for the rest of the page.

**Reduced motion is a first-class path, not a disabled one.** With
`prefers-reduced-motion: reduce` the `html.rm` rules collapse every tall
scroll-scrub section to its natural height and show all the copy at once. The
same story, none of the movement.

## Analytics

The page carries **one** tag: the Google Tag Manager container in `<head>`
(plus its `<noscript>` iframe as the first thing in `<body>`). GA4 is configured
*inside* the container, never hardcoded in the HTML — so tags can change without
a redeploy, and a pageview can never be counted twice.

| Thing | ID |
| --- | --- |
| GTM account | `6376575028` ("Jahidul Islam") |
| GTM container | `GTM-M2H2DGDC` (internal `263991270`) |
| GTM tag | `GA4 - Config - Anti-xor` — Google Tag on *Initialization - All Pages* |
| GA4 account | `407773507` ("Jahidul Islam") |
| GA4 property | `553887405` ("Anti-xor") |
| GA4 data stream | `15767802063` ("Anti-xor site") |
| GA4 measurement ID | `G-ZS79L6JPKC` (fires from inside GTM) |

One container per site, all under one account — the same pattern as the Flying
Man and Atelier containers.

To verify the chain in the browser console:

```js
Object.keys(window.google_tag_manager)
// must contain BOTH "GTM-M2H2DGDC" (the container)
// and "G-ZS79L6JPKC" (the GA4 tag the container loaded)
```

If only the `GTM-` key is there, the container loaded but the tag did not fire —
check that the container version is *published*, not merely saved.

## Search Console

Property: **URL prefix** `https://anti-xor.pages.dev/` — a Domain property is
impossible here because `pages.dev` is on the Public Suffix List and its DNS is
not ours.

Ownership was verified automatically by the **Google Tag Manager** method, which
means the verification depends on the container snippet staying in `<head>`.
Remove the snippet and the property loses verification. `sitemap.xml` is
submitted, and the home page has been sent to the priority crawl queue.

## Local development

```bash
npm run dev          # wrangler pages dev public --port 4180
```

Wrangler serves `public/` exactly as Cloudflare Pages will, `_headers` included,
so a CSP mistake shows up locally instead of in production.

## Deploy

```bash
npm run deploy       # wrangler pages deploy public --project-name anti-xor
```

Every deploy also gets its own immutable preview URL, so a bad deploy is a
matter of promoting the previous one rather than fixing forward.

## Licence / attribution

Brand, copy and artwork are for this concept. The Sora and Manrope typefaces are
loaded from Google Fonts under the SIL Open Font License.
