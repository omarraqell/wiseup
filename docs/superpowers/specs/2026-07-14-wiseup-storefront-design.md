# WISEUP Storefront — Design

**Date:** 2026-07-14
**Status:** Approved (Phase 1 + Phase 2 scoped for first implementation)

## Problem

WISEUP has a 633-product Arabic hand-tools catalog with JOD prices, currently reachable
only through an AI chat assistant. There is no way for a customer to browse products or
place an order. We want a customer-facing storefront where people log in and buy, with
distinct treatment for retail and business customers.

## Goals

- A bilingual (AR/EN) storefront over the existing 633-product catalog.
- Firebase-authenticated accounts in two roles: `personal` and `business`.
- **Business accounts never see prices.** They request quotes instead of buying.
- Personal accounts see prices and place orders (no online payment).
- Preserve the existing LangGraph RAG agent as a chat widget.

## Non-Goals

- **No online payment gateway.** Orders are fulfilled offline (cash on delivery / bank
  transfer). Payment is explicitly out of scope and may become a later spec.
- **No business-approval workflow.** Business accounts see *less* than personal accounts
  (no prices), so there is no incentive to falsely claim business status. Self-declaration
  at signup is sufficient. This changes only if negotiated B2B pricing is added later.
- **No negotiated/tiered B2B pricing.** Businesses get quotes by email, not price tiers.
- No inventory/stock tracking (the data has no stock field).
- No migration of products into Firestore.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| B2B model | Request-for-quote (RFQ) | Resolves "no prices but must order"; reuses existing `email_owner` lead flow |
| Checkout depth | Order request, no payment | No gateway/PCI scope; matches existing offline sales |
| Categories | Crawl 28 series from wiseuptools.com | Matches the real brand taxonomy; one-time script |
| Language | Bilingual AR/EN toggle, RTL-capable | Arabic customers + English reach |
| AI assistant | Keep as floating chat widget | Preserves RAG work; differentiates the store |
| Stack | Keep FastAPI + static HTML | Stitch emits HTML+Tailwind; no build step; reuses RAG/images/email |
| Business signup | 3-step wizard | Room to add trade-license upload later without redesign |
| Page design | Stitch, model `GEMINI_3_1_PRO` | Newest available (`GEMINI_3_PRO` is deprecated) |

## Architecture

Unchanged from today: FastAPI serves pages, images, and JSON. Firebase is added for
identity and orders only.

```
Browser                                  FastAPI (:8000)
  │  Firebase JS SDK → login → ID token
  │  GET /api/products  (Bearer token)  →  verify token (firebase-admin)
  │                                        look up users/{uid}.role
  │                                        ├─ personal → include price_jod
  │                                        └─ business → OMIT price_jod
  │  ← JSON                                 serve frontend/*.html, /images/*
  │
  └─ Firebase: Auth (identity) + Firestore (users, orders)
```

Stitch generates screen designs and frontend code only. It does not implement auth, the
RFQ flow, or the price rule — that logic is ours, in FastAPI.

### Why products stay in `products.json`

`rag.py` (Chroma + BM25), `tools.py`, and `/images` all read `products.json` today.
Moving products to Firestore would break working retrieval for no benefit. Firebase holds
only users and orders.

## The price rule (load-bearing)

**Hiding prices in HTML does not hide them.** A business user opening DevTools would see
any price the server sent. Therefore:

1. Price omission happens **server-side**. `price_jod` is never serialized into a response
   for a business account.
2. Enforcement lives in **one chokepoint function** that every product-returning path
   calls — catalog API, product detail, search, and the agent's `retrieve_products` tool.
   Per-endpoint implementations will eventually miss one and leak prices through search.
3. **The AI agent must be price-stripped at the tool boundary**, before the model sees the
   data. The agent today says *"الأسعار تبدأ من 0.45 دينار أردني"* unprompted. A model
   cannot be reliably prompted into keeping a secret it was given; do not give it the
   secret.

### Order integrity

Orders store item **codes and quantities, never prices**. The server recomputes totals
from `products.json` at read time, so a tampered browser payload cannot invent a
0.01 JOD order.

## Data model

### `products.json` (633 items — enriched in Phase 1)

| Field | Status | Notes |
|---|---|---|
| `code` | existing | e.g. `"10101"`; lengths vary (5–14) |
| `name_ar` | existing | Arabic name |
| `unit` | existing | e.g. `"pcs"` |
| `price_jod` | existing | **server-side only for business accounts** |
| `image` | existing | e.g. `"images/10101.png"` (631 images present) |
| `name_en` | **new** | LLM translation of `name_ar` |
| `category` | **new** | English category name, from site crawl |
| `category_ar` | **new** | Arabic category name, from site crawl |

### Firestore

```
users/{uid}
  role         "personal" | "business"
  email, name, phone
  company      { name, city, type }     // business only, from wizard
orders/{id}
  uid
  type         "order" | "rfq"
  items        [{ code, qty }]          // no prices
  contact      { name, phone, email, address }
  status       "new"
  created_at
```

## Category derivation

The first 2 digits of `code` form 29 groups, closely matching the site's 28 series. The
grouping is real but **not shippable as-is**:

- Group `17` lumps 124 items (heat guns + grass trimmers + generators) — ~20% of catalog.
- Group `64` is mixed (air blower, grease gun, trolley jack).
- Groups `04`, `61`, `70`, `TH` have exactly 1 product each.
- `B1` and `TH` are non-numeric.
- **No group has a name.**

Approach: crawl the real series names from `https://www.wiseuptools.com/h-col-103.html`,
then map products — code prefix first, LLM for stragglers and for splitting group `17`.
Owner reviews the output once.

## Phasing

Four independent builds, each with its own spec → plan → implement cycle.
**This spec covers Phase 1 + Phase 2.** Phases 3 and 4 get their own spec.

### Phase 1 — Data foundation (no UI)

- Crawl 28 series names (AR/EN) from wiseuptools.com.
- Map all 633 products into categories (code prefix + LLM for stragglers).
- Translate 633 `name_ar` → `name_en`.
- Output: enriched `products.json`.

### Phase 2 — Public storefront (no login)

- Stitch screens: `index.html` (landing), `catalog.html`, `category.html`, `product.html`.
- Bilingual AR/EN toggle, RTL.
- Prices visible to everyone (no auth exists yet).
- AI chat widget on every page.

### Phase 3 — Auth + roles (later spec)

Firebase Auth; personal signup + 3-step business wizard; token verification; the
price-stripping chokepoint; agent respects role.

### Phase 4 — Cart → order / RFQ (later spec)

Personal: cart → checkout → order. Business: request list → RFQ. Both persist to
Firestore and email the owner.

## Stitch workflow

```
create_project        "WISEUP Store"
create_design_system  customColor  #E60616    // existing brand red
                      headlineFont OSWALD     // matches current site
                      bodyFont     INTER
                      roundness    ROUND_FOUR
                      colorMode    LIGHT
generate_screen_from_text
                      modelId      GEMINI_3_1_PRO
                      deviceType   DESKTOP
```

Then: retrieve each screen's code → save into `frontend/` → wire data → FastAPI serves.
This mirrors how the existing `frontend/index.html` was produced (Tailwind CDN +
`tailwind.config` + Material Symbols is Stitch's output signature).

## Testing

**Phase 1 carries the real risk** — a bad enrichment script that silently drops 40
products is invisible until a customer cannot find a saw.

- Every one of the 633 products lands in exactly one category.
- Every product has a non-empty `name_en`.
- No product loses `price_jod`, `code`, or `image` during enrichment.
- Category count matches the crawl.
- Product count is exactly 633 before and after.

**Phase 2:**

- Each page returns 200 and does not 500.
- Category listing returns only products in that category.
- Product detail returns 404 for an unknown code.

## Open risks

- **Crawl accuracy.** Category names depend on wiseuptools.com being correct and
  crawlable. The crawl already works (`browse_wiseup_website`, Tavily), but the mapping
  needs owner review.
- **Translation quality.** LLM translations of Arabic tool names (e.g. `"زرادية"`,
  `"بكس"`, `"شق رنق"`) are trade jargon and may be wrong. Owner review required.
- **Group 17.** 124 items must split into sensible series; this is the most likely place
  for the mapping to look bad.
