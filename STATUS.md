# Status — 13 Sep 2026

Where the project stands, so it can be picked up cold. Permanent facts (ids,
architecture, how to deploy) live in [README.md](README.md); this file is only
*what is done* and *what is left*. Delete it when the open items are closed.

---

## ✅ Done and verified

| | Where | Verified how |
| --- | --- | --- |
| **Live** | https://anti-xor.pages.dev | full audit: 0 console errors, 0 failed requests, 0 CSP violations |
| **Source** | https://github.com/jahid-dev-analytics/anti-xor | pushed, working tree clean |
| **Cloudflare Pages** | project `anti-xor` | `npm run deploy`; the apex tracks the newest deployment |
| **GTM** | `GTM-M2H2DGDC` | Version 2 published, not merely saved |
| **GA4** | property `553887405`, `G-ZS79L6JPKC` | Realtime report returns live pageviews |
| **Search Console** | URL-prefix `https://anti-xor.pages.dev/` | verified by the GTM method; sitemap submitted |
| **Hero car** | 24-frame turntable | three distinct angles captured through the turn, live |
| **Fleet cards** | five night photographs | all five 200, credited in the README |

### The last full audit

Run against the live site over CDP — console, network, CSP, layout and the
analytics chain in one pass:

```
requests 37 · transfer 1505KB
errors 0 · failed 0 · csp violations 0
images without alt 0 · broken images 0 · dead anchors 0
JSON-LD valid · one h1 · lang set · canonical + OG present
GTM-M2H2DGDC + G-ZS79L6JPKC both live, _ga cookie set
horizontal overflow at 375 / 820 / 1366: none
```

Also checked by hand: every shipped file returns 200, `/nope` returns a real
404, reduced motion renders the whole page without the scroll-scrub, and a
phone pulls **only** the small frame set (24/24 from `sm/`) while a desktop
pulls only the full one.

`/404.html` answers 308 → `/404` → 200. That is Cloudflare Pages stripping the
extension, not a fault; unmatched paths still get a real 404.

---

## ⬜ Open item 1 — the car is not photoreal

The turntable **mechanism** is finished and live. The frames in it are rendered
from the site's own procedural car, so the picture quality is what it always
was — what changed is that it is now rendered ahead of time, at twice the size
and downscaled.

Making it look like the silver reference car needs better *frames*, and every
route to those needs something that is not in the repo:

| Route | Blocked on |
| --- | --- |
| AI-generated turntable | Higgsfield credits — balance is **0** on the free plan |
| Licensed stock turntable | a paid asset |
| Real 3D model rendered offline | a photoreal sedan model with a usable licence |

When frames exist, the swap is **files only**: drop 24 WebP frames into
`public/assets/car/` (1200×720) and `public/assets/car/sm/` (600×360), named
`f00`–`f23`, going once around. No code changes.

A real manufacturer's car should not be copied badge-for-badge onto a rental
brand's site — a generic silver performance saloon is the thing to aim for.

## ⬜ Open item 2 — custom domain

**Blocked on one piece of information: which domain.** There is no registered
domain on the account; the only zone that ever existed was for an unregistered
name and has been deleted.

Availability checked 13 Sep 2026: `antixor.com` taken; `anti-xor.com`,
`antixor.net`, `antixor.dev`, `antixor.app` and `driveantixor.com` all free.

When a domain exists:

```bash
node tools/set-domain.mjs your-domain.com
```

It rewrites the canonical tag, the OG/Twitter tags, `robots.txt`, `sitemap.xml`
and the README together — they have to agree, because a page that
canonicalises to a host it no longer serves tells Google to index the wrong
domain. It then prints the four steps outside this repo: add the custom domain
in Pages, set the GA4 stream URL, add and verify a new Search Console property,
deploy.

**Cloudflare Registrar** is the simplest place to buy: at-cost, and the domain
lands in the same account so no nameserver change is needed.

## ⬜ Open item 3 — page weight

Desktop ships ~1.2 MB of turntable frames where it used to ship 20 KB of
shader. Frame 0 loads immediately and the other 23 wait for the load event, so
the first screen is not affected — but the total is what it is.

The dial is the frame count: `npm run frames 16` still reads as smooth and cuts
it by a third. Worth doing if the site ever has to answer to a performance
budget.

---

## Notes for whoever picks this up

- `chrome --headless --screenshot` **paints nothing after a programmatic
  scroll** — even a `position:fixed` element disappears. Anything that needs a
  scrolled pose has to go through CDP, which also is the only way to get WebP
  out of Chrome.
- A `file://` URL containing **spaces** silently fails to load subresources.
  Percent-encode it. And a page's own `<script src="/js/scene.js">` resolves to
  the drive root under `file://` and takes the whole render down with it.
- The Cloudflare dashboard keeps destructive buttons disabled until you type
  the resource name into a confirm field, and it ignores clicks sent by element
  reference — `hover` then click at real coordinates.
- `wrangler pages project create` delegates to the Workers-based Pages and
  fails; `--force` is needed **once, at creation only**.
- Search Console ownership rests on the GTM snippet staying in `<head>`.
- `css/site.css` and `js/scene.js` carry no content hash, so `_headers` keeps
  them at `max-age=300, must-revalidate`. The frames and other assets are
  content-stable and sit at a week.
