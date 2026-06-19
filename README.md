# The Dutty Brush

Studio site for **The Dutty Brush** — a Warhammer & tabletop miniature‑painting
commission studio. A fast, buildless static site for GitHub Pages, with a live
project tracker ("The Forge") and a no‑backend admin editor that commits straight
to `data.json`.

🌐 **Live:** [theduttybrush.com](https://theduttybrush.com)

---

## Stack

- **Vanilla HTML / CSS / JS** — no framework, no build step, no CDN runtime.
- **Design tokens** in `:root` (colours, type, spacing, motion) drive the whole UI.
- **ES modules** for behaviour; data fetched from a single `data.json`.
- Fonts: Archivo (display), Inter (body), JetBrains Mono (labels) via Google Fonts.
- Images optimised on the fly through Cloudinary transforms.

Deploys as‑is: GitHub Pages serves the repo root; `CNAME` maps the domain.

## Pages

| File | Purpose |
| :--- | :--- |
| `index.html`   | Landing: hero, **The Forge** live tracker, selected work, commission tiers, process, about, contact. |
| `gallery.html` | The Workbench — full searchable / faction‑filterable catalogue, project viewer, and the hidden admin editor. |
| `hobby.html`   | Redirect to `gallery.html` (preserves old `?project=` deep links). |

## Structure

```text
index.html · gallery.html · hobby.html
data.json                     single source of truth (project array)
CNAME · robots.txt · sitemap.xml
assets/
  css/styles.css              design system: tokens + components
  js/
    core.js                   shared: safe DOM/escape helpers, data layer, toast, nav, reveal
    home.js                   landing logic (Forge strip, selected work)
    gallery.js                catalogue: grid, search, filters, project viewer, deep links
    admin.js                  hardened GitHub‑token CMS
  img/                        avatar.jpg · featured.jpg · baselair.png
```

## Data model (`data.json`)

```jsonc
[
  {
    "title": "Saturnine Praetor",        // project name
    "faction": "Adeptus Astartes",       // one of the canonical 40K factions
    "progress": 15,                      // 0–100; <100 shows in The Forge
    "category": "Personal",              // "Commission" | "Personal"
    "thumbnail": "https://…",            // cover image (Cloudinary)
    "notes": "Field notes…",
    "gallery": ["https://…"],            // additional photos
    "paints": { "Base": "Purple", … }    // stage → paints map
  }
]
```

Reads are tolerant of the legacy field names (`name`, `percentage`, `type`, `image`),
but the editor always writes the canonical schema above.

## The Forge (admin editor)

The Workbench includes a browser‑based CMS that writes `data.json` via the GitHub
Contents API — no server required.

1. **Studio Login** → paste a **fine‑grained Personal Access Token** scoped to the
   `theduttybrush` repo with **Contents: Read and write**.
2. The token is verified against the repo (including write permission) before it is
   accepted, and is stored only in `sessionStorage` (cleared when the tab closes).
3. Add, edit or delete projects. On save the whole list is re‑serialised and committed
   with optimistic‑concurrency (latest file SHA re‑read immediately before each write).

**Security notes**
- All project data is rendered via DOM / `textContent` — no `innerHTML` of user data, so no XSS.
- Inputs are validated (required name, 0–100 progress, valid URL thumbnail, known faction).
- Destructive deletes require confirmation.
- The token is never written to disk or committed; treat it like a password and use the
  shortest practical expiry.

## Local development

ES modules require HTTP (not `file://`). From the repo root:

```bash
python -m http.server 8080
# open http://localhost:8080
```

The admin editor needs a real GitHub token and network access; the public pages work fully offline‑of‑GitHub against the local `data.json`.

## Design tokens

Defined once in `assets/css/styles.css`:

| Token | Value | Role |
| :--- | :--- | :--- |
| `--bg` | `#07070a` | Canvas |
| `--acc` | `#ff3e3e` | Dutty Red |
| `--gold` | `#d6a23c` | Laurel accent |
| `--ok` | `#3ad07a` | Commissions‑open status |
| `--disp` / `--ui` / `--mono` | Archivo / Inter / JetBrains Mono | Type scale |

---

*The Dutty Brush © 2026 — hand‑crafted in the studio.*
