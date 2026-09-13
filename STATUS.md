# Status — 13 Sep 2026

A snapshot of where this project stands, so it can be picked up cold. Permanent
facts (ids, architecture, how to deploy) live in [README.md](README.md); this
file is only *what is done* and *what is left*. Delete it when the open items
are closed.

---

## ✅ Done and verified

| | Where | Verified how |
| --- | --- | --- |
| **Source on GitHub** | https://github.com/jahid-dev-analytics/anti-xor | pushed, working tree clean |
| **Cloudflare Pages** | project `anti-xor` | `npm run deploy`; every deployment URL serves correctly |
| **GTM** | `GTM-M2H2DGDC` | Version 2 "GA4 base tracking" **published**, not merely saved |
| **GA4** | property `553887405`, `G-ZS79L6JPKC` | Realtime report returned 1 active user / 1 pageview |
| **Search Console** | URL-prefix `https://anti-xor.pages.dev/` | auto-verified by the GTM method; sitemap submitted; home page queued for crawl |
| **Fleet photographs** | `public/assets/fleet/*.jpg` | five night photos replacing the SVG cars; see README for sources |
| **Phantom zone removed** | Cloudflare account | `deamyphotoghtaphy.com` deleted; the account now has zero zones |

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

## 🔴 Open item 1 — `anti-xor.pages.dev` is serving a stale build

**This is a Cloudflare-side fault, not a deployment mistake.** Every deployment
is correct; the vanity hostname is bound to an old one and will not move.

What the evidence shows:

- deployment URLs serve the current build — `/assets/fleet/sports.jpg` → **200**
- `anti-xor.pages.dev` → **404** for that same path
- Cloudflare's own API and dashboard both report the newest deployment as
  `canonical_deployment`, `latest_deployment`, environment *production*, and
  `domains: ["anti-xor.pages.dev"]`
- **not a response cache**: a `?cb=<random>` query changes nothing
- **not one edge server**: forcing the apex hostname onto a different Cloudflare
  anycast IP with `curl --resolve` returns the same stale build
- **not one POP**: apex and deployment URL both answer from `DAC`
- the build being served is the one from deployment `79c5a764` — identifiable by
  its `_headers` (`max-age=3600`) and the absence of the hero scrim — **and that
  deployment has since been deleted**. The hostname is pinned to something that
  no longer exists.

Tried and did not help: three fresh production deploys, ~45 minutes of waiting,
and deleting the stuck deployment outright.

**Meanwhile the site is viewable** at whichever deployment URL is newest —
`npx wrangler pages deployment list --project-name anti-xor` prints them.

**Next steps, in order of preference:**

1. Wait. A binding to a deleted deployment should reconcile on its own.
2. Raise it with Cloudflare support: project `anti-xor`, account
   `e7ceb255da0b8e948ee088b6ce080a22` — "pages.dev subdomain is serving a
   deleted deployment while the API reports the correct canonical deployment."
3. Attach a custom domain (see below). A custom hostname is bound separately
   from the `.pages.dev` subdomain, so it should route correctly and would make
   this moot.

Do **not** solve it by renaming the project. The canonical tag, the GA4 stream
URL and the verified Search Console property all name `anti-xor.pages.dev`.

---

## ⬜ Open item 2 — custom domain

**Blocked on one piece of information: which domain.** There is no registered
domain on the account to attach — the only zone that existed was for a name
nobody had registered, and it has now been deleted.

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

## Notes for whoever picks this up

- `wrangler pages project create` in wrangler 4.13x delegates to the new
  Workers-based Pages and fails. `--force` is needed **once, at creation only** —
  never again afterwards.
- Headless **Edge** writes no screenshot file and reports no error. Use
  `chrome.exe --headless=new --screenshot=<absolute path>` instead.
- The Cloudflare dashboard's "Remove from Cloudflare" dialog keeps its Remove
  button disabled until you **type the domain name** into a confirm field, and
  that page ignores clicks sent by element reference — `hover` then click at real
  coordinates. Both together are why the first removal attempts looked broken.
- Search Console ownership rests on the GTM snippet staying in `<head>`. Remove
  the snippet and the property silently loses verification.
- `css/site.css` and `js/scene.js` carry no content hash, so `_headers` keeps
  them at `max-age=300, must-revalidate`. Raise it only if a build step ever
  hashes the filenames.
- Redesigning the car means re-splitting the artifact into `public/js/scene.js`
  and `public/css/site.css` — republishing the artifact alone does not touch
  this site.
