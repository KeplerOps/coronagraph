# Web Dashboard

Server-rendered web UI for browsing items, reading briefs, managing collections, and viewing system status.

## Architecture

**File**: `src/server/app.ts`

| Setting | Value |
|---------|-------|
| Framework | Hono |
| Rendering | Server-side JSX (Hono JSX runtime) |
| Interactivity | HTMX 2.0.4 (CDN) |
| Styling | Tailwind CSS (CDN) + Inter font |
| Theme | Dark (bg-gray-950) |
| Middleware | `logger()` for all routes |

## Routes

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{ status: "ok", timestamp }` |
| GET | `/api/items` | Paginated items, filterable by `source`, `type`, `limit`, `offset` |
| GET | `/api/items/:id` | Single item by UUID |

### Page Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Feed page — filterable, searchable, paginated item grid |
| GET | `/feed/items` | HTMX partial — returns item cards for live filtering |
| GET | `/items/:id` | Item detail page with metadata, content, annotations |
| POST | `/items/:id/annotations` | Add annotation (HTMX form) |
| GET | `/briefs` | Briefs list (100 most recent) |
| GET | `/briefs/:id` | Brief detail with rendered markdown |
| GET | `/collections` | Collections list |
| POST | `/collections` | Create collection (HTMX form) |
| GET | `/collections/:id` | Collection detail with item cards |
| GET | `/settings` | Read-only system status and configuration |

## Components

### Layout (`src/server/layouts/base.tsx`)

Base layout with:

- Sticky top navigation bar with Coronagraph logo
- Navigation links: Feed, Briefs, Collections, Settings
- Responsive container with max-width
- Custom animations: card hover, fade-in, pulse dot for status indicators

### Filters (`src/server/components/filters.tsx`)

Search and filter bar on the feed page:

- Text search input with 300ms debounce (HTMX `keyup changed delay:300ms`)
- Source dropdown: All, NVD, arXiv, Inoreader, CISA KEV, GitHub Advisories
- Type dropdown: All, Vulnerability, Paper, Article, Advisory
- Live filtering via HTMX `hx-get="/feed/items"` with `hx-target="#items-list"`

### Item Card (`src/server/components/item-card.tsx`)

Two components:

- `ItemCard` — single card with title (2-line clamp), summary (3-line, 200 chars), source/type badges, first 3 topic tags, relative time
- `ItemCardList` — grid of cards with "Load more" pagination via HTMX

### Utility Libraries

**Badges** (`src/server/lib/badges.ts`):

| Source | Color | Label |
|--------|-------|-------|
| `nvd` | Red | NVD |
| `arxiv` | Blue | arXiv |
| `inoreader` | Emerald | Inoreader |
| `cisa-kev` | Orange | CISA KEV |
| `github-advisories` | Purple | GitHub |

**Formatting** (`src/server/lib/format.ts`):

- `relativeTime(date)` — "just now", "5m ago", "3h ago", "2d ago", or "Jan 15"
- `formatDate(date)` — "Month Day, Year Hour:Minute"
- `truncate(str, max)` — truncates with ellipsis

## HTMX Patterns

The dashboard uses HTMX for interactivity without client-side JavaScript:

- **Live search**: Filter form triggers `hx-get` on keyup with debounce
- **Load more**: Button sends paginated request, appends results with `hx-swap="beforeend"`
- **Add annotation**: Form posts via `hx-post`, resets on success
- **Create collection**: Form posts, redirects to new collection page
