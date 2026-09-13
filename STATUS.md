# Status — paused 13 Sep 2026

A snapshot of where this project stopped, so it can be picked up cold.
Permanent facts (ids, architecture, how to deploy) live in [README.md](README.md);
this file is only *what is done* and *what is left*. Delete it when the open
items are closed.

---

## ✅ Done and verified

| | Where | Verified how |
| --- | --- | --- |
| **Site is live** | https://anti-xor.pages.dev | `curl` → 200; headers, CSP and a real 404 all confirmed |
| **Source on GitHub** | https://github.com/jahid-dev-analytics/anti-xor | 4 commits, working tree clean, pushed |
| **Cloudflare Pages** | project `anti-xor` | deployed twice; `npm run deploy` redeploys |
| **GTM** | `GTM-M2H2DGDC` | Version 2 "GA4 base tracking" **published** (not just saved) |
| **GA4** | property `553887405`, `G-ZS79L6JPKC` | Realtime report returned 1 active user / 1 pageview |
| **Search Console** | URL-prefix `https://anti-xor.pages.dev/` | auto-verified by the GTM method; sitemap submitted; home page in the priority crawl queue |

The analytics chain was proven on the live page, not assumed —
`Object.keys(window.google_tag_manager)` contained **both** `GTM-M2H2DGDC` and
`G-ZS79L6JPKC`, and the `_ga_ZS79L6JPKC` cookie was set.

### What was built from the artifact

The single-file artifact became a hostable site: HTML split from `css/site.css`
and `js/scene.js` so both cache; full SEO head (canonical, Open Graph, Twitter,
manifest, favicon); a generated 1200×630 `og.png`; a matching 404 page that
returns a real 404; `robots.txt` and `sitemap.xml`; and `_headers` carrying CSP,
nosniff, `X-Frame-Options: DENY`, referrer and permissions policy plus cache
rules. Everything shippable sits in `public/`, so the README, tooling and `.git`
cannot reach a deployment.

Two deliberate omissions, both to stay on the right side of Google:

- **no review/rating JSON-LD** — the testimonials and the 4.9-star rating are
  invented for layout, and marking up invented ratings is what earns a
  structured-data manual action
- **the footer says "Concept site"** in bold, so no visitor mistakes the sample
  fleet, prices and reviews for a real rental business

---

## ⬜ Open item 1 — custom domain

**Blocked on one piece of information: which domain.**

The Cloudflare account has exactly one zone, `deamyphotoghtaphy.com` — status
*pending*, never activated, and RDAP says **it is not registered at any
registrar**. It is a phantom zone (and a typo of "dreamyphotography"), so
nothing can be attached to it.

Availability checked 13 Sep 2026:

| Domain | |
| --- | --- |
| `antixor.com` | taken |
| `anti-xor.com` | free |
| `antixor.net` · `antixor.dev` · `antixor.app` | free |
| `driveantixor.com` | free |

**When a domain exists**, the swap is one command:

```bash
node tools/set-domain.mjs your-domain.com
```

That rewrites the canonical tag, the OG/Twitter url + image tags, `robots.txt`,
`sitemap.xml` and the README together — they have to agree, because a page that
canonicalises to a host it no longer serves tells Google to index the wrong
domain. The script then prints the four steps that live outside this repo:

1. Cloudflare Pages → `anti-xor` → Custom domains → add it, wait for SSL
2. GA4 → Admin → Data streams → "Anti-xor site" → set the stream URL
3. Search Console → add the new URL-prefix property → verify → submit sitemap
4. `npm run deploy`

If buying: **Cloudflare Registrar** is simplest — at-cost pricing and the domain
lands in the same account, so no nameserver change is needed.

---

## ⬜ Open item 2 — delete the phantom zone

Asked for, **attempted, and not completed.** The zone is still there.

- The API route is closed: the wrangler OAuth token is `zone (read)` only —
  even reading DNS records returns 401.
- The dashboard route would not respond to automation: "Remove from Cloudflare"
  was clicked by element reference, by coordinate (JS confirmed the element sat
  exactly there), and by focus + Enter. The confirm dialog opened exactly once
  and its Remove button did nothing. Screenshots of that page also time out.

**Manual path, about 30 seconds:** dash.cloudflare.com → `deamyphotoghtaphy.com`
→ Overview → bottom right **Advanced Actions** → **Remove from Cloudflare** →
**Remove**.

Leaving it is harmless — an inactive zone for an unregistered domain serves
nothing and costs nothing. It only makes the domain list look untidy.

---

## Notes for whoever picks this up

- `wrangler pages project create` in wrangler 4.13x delegates to the new
  Workers-based Pages and fails. `--force` is needed **once, at creation only** —
  never again afterwards.
- Headless **Edge** writes no screenshot file and reports no error. Use
  `chrome.exe --headless=new --screenshot=<absolute path>` instead.
- Search Console ownership here rests on the GTM snippet staying in `<head>`.
  Remove the snippet and the property silently loses verification.
- Redesigning the car means re-splitting the artifact into `public/js/scene.js`
  and `public/css/site.css` — republishing the artifact alone does not touch
  this site.
