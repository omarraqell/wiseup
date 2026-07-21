# WISEUP Phase 3 — Auth + Roles (Supabase) — Design

**Date:** 2026-07-21
**Status:** Approved

## Problem

Phase 2 shipped a public storefront (Next.js frontend, Express + Prisma backend, Postgres
in a local Docker container) where every visitor sees prices. There are no accounts yet,
so there is no way to give business customers a different (price-free) experience, and the
database only exists on one machine's Docker Desktop.

This spec covers **Phase 3** from the original Phase 1+2 design
(`docs/superpowers/specs/2026-07-14-wiseup-storefront-design.md`): accounts, roles, and the
price-stripping rule that Phase 2 was deliberately built to make a small addition rather
than a retrofit. It also folds in an infrastructure change requested alongside it: moving
the Postgres database's hosting to Supabase, and using **Supabase Auth** instead of the
Firebase Auth named in the original spec (the codebase has since diverged from that spec's
FastAPI-serves-static-HTML architecture into a Next.js frontend + Node/Express + Prisma
backend + a separate Python AI microservice — Supabase's Postgres-native auth fits this
stack more directly than adding Firestore as a second database).

## Goals

- Visitors can keep browsing the catalog anonymously, exactly as today — no login wall.
- Anyone can sign up and choose a role: **personal** or **business**.
- **Business accounts never receive `price_jod`**, from any product-serving endpoint,
  enforced server-side (not hidden client-side).
- Personal accounts and anonymous visitors see prices, identically to today.
- The Postgres database moves from local Docker to a Supabase-hosted project; local dev
  and production point at the same Supabase database (single source of truth, no
  dev/prod schema drift).
- Fix a real gap in the current Node backend: `backend/src/routes/products.ts` hand-builds
  two separate response objects (list, detail) instead of routing through one serializer —
  exactly the "per-endpoint implementations will eventually miss one" risk the original
  spec warned about. This phase introduces that chokepoint as part of adding the price rule.

## Non-Goals

- **The AI chat agent's price-awareness.** The chat widget keeps showing prices to every
  caller, business or not, for now. Making the agent role-aware (passing role from
  frontend → Express → the Python AI service → `ai-service/tools.py`'s card builder) is
  deferred to a later, smaller spec.
- **Cart, checkout, and RFQ.** Unchanged from the original phasing — that's Phase 4.
- **Business-account approval workflow.** Self-declared role at signup is sufficient, same
  reasoning as the original spec: business accounts see *less* than personal accounts, so
  there's no incentive to falsely claim business status.
- **A dedicated account/profile-editing page.** Signup collects name/phone/company once;
  editing that data later isn't in scope and isn't a blocker for anything else here.
- **Full database-level RLS on products.** Considered and rejected for this phase — see
  "Enforcement approach" below.
- **A multi-step business signup wizard.** The original Phase 2 spec proposed one "to leave
  room for a trade-license upload later." Since there's still no approval workflow to gate
  on, a single-page form (with a Personal/Business toggle) covers the same fields without
  the multi-step scaffolding.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Identity provider | Supabase Auth (replaces Firebase from the original spec) | Same Postgres the app already uses via Prisma; no second database needed for users |
| DB hosting | Supabase-hosted Postgres, same connection for local dev and prod | Original spec's Firestore-for-users/Postgres-for-products split no longer applies; one database is simpler and this repo already runs Prisma against Postgres |
| Anonymous browsing | Kept — logged-out visitors see prices, same as today | No login wall; matches the live Phase 2 experience, only business accounts opt into less |
| Business signup | Single-page form with a Personal/Business toggle | No approval workflow exists to justify a multi-step wizard; toggle reveals company fields inline |
| Email confirmation | Required before login, for both roles | Standard Supabase default; cuts down on throwaway signups at near-zero cost |
| Price-rule enforcement | App-level chokepoint (`serializeProduct()`) + Postgres RLS on `profiles` only | Express/Prisma is the only path to product data — full RLS on `products` would mean re-architecting Prisma's connection model for no reachable benefit. RLS *is* used on `profiles` as real defense-in-depth on user-owned data. |
| Agent price-awareness | Deferred | Explicitly out of scope per the user; tracked as a follow-up |

## Architecture

```
Browser (Next.js)
  │  @supabase/ssr → signup/login/logout → Supabase session (cookie-based)
  │
  │  GET /api/products, /api/products/:code   (Authorization: Bearer <supabase access token>, optional)
  ▼
Express backend (:4000)
  │  authMiddleware: verifies token if present → looks up profiles.role → req.user = {id, role} | undefined
  │  productsRouter: calls serializeProduct(product, { includePrice: req.user?.role !== "business" })
  ▼
Prisma → Supabase Postgres (single connection string, same DB for local dev and prod)
  │  tables: categories, products, chat_sessions, chat_messages, leads  (existing, unchanged shape)
  │          profiles (new — role, name, phone, company)                (new)
  │  RLS: enabled on profiles only — a user can read/write only their own row
  ▼
Supabase Auth  →  owns auth.users (email, password hash, email_confirmed_at)
```

Anonymous requests (no token, or an invalid/expired one) behave exactly like today: full
price visibility, no error. Only a validated business-role session strips `price_jod`.
`authMiddleware` never rejects a request for a missing/bad token on public catalog routes —
it simply leaves `req.user` unset, which resolves to "show prices."

### Why not full RLS on products

Giving `products` an RLS policy keyed on role would require Prisma to run queries as the
authenticated Supabase user rather than through a single pooled service-role connection —
a real re-architecture of how the backend talks to Postgres. The Express/Prisma API is the
*only* path to product data in this system (no other client queries Postgres directly), so
that investment buys no additional protection here. The existing pattern in
`ai-service/catalog.py`'s `serialize_product()` already validates the app-level-chokepoint
approach for this exact rule; this spec brings the Node backend in line with it.

## Data model

New `profiles` table (Prisma model, ordinary `public` schema table, distinct from
Supabase's own `auth.users`):

```prisma
model Profile {
  id          String   @id @db.Uuid          // same UUID as auth.users.id
  role        String   @db.VarChar(20)       // "personal" | "business"
  name        String
  phone       String?
  companyName String?  @map("company_name")  // business only
  companyCity String?  @map("company_city")  // business only
  companyType String?  @map("company_type")  // business only
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("profiles")
}
```

- Populated by a Postgres trigger on `auth.users` insert (standard Supabase pattern): the
  trigger reads `raw_user_meta_data` (role, name, phone, company fields passed at signup)
  and creates the matching `profiles` row. The row exists once the account is created;
  Express never has to manually sync it.
- RLS policy on `profiles`: `auth.uid() = id` for select/update — a user can only ever see
  or edit their own profile, enforced at the database level regardless of access path.
- No schema changes to `categories`, `products`, `chat_sessions`, `chat_messages`, or
  `leads` — they change hosts (Docker → Supabase) but keep their existing shape and data.

## Auth & frontend flows

- **`/signup`** — single page. Fields: email, password, name, phone, plus a
  Personal/Business toggle at the top. Toggling to Business reveals company
  name/city/type fields. Submits via `supabase.auth.signUp()` with the extra fields as
  user metadata (consumed by the DB trigger above). Supabase emails a confirmation link
  for both roles identically; the page shows a "check your email" state after submit.
  The account cannot log in until the link is clicked and `email_confirmed_at` is set.
- **`/login`** — email + password. On success, `@supabase/ssr` sets the session cookie;
  redirect to home.
- **Forgot password** — a link on `/login` triggers Supabase's password-reset email; a
  `/reset-password` page sets the new password.
- **Logout** — clears the Supabase session; header reverts to logged-out state.
- **Header/nav** — shows Login/Signup when logged out; shows the account name, a role
  badge, and Logout when logged in.
- **Route protection** — none of the existing pages (`/catalog`, `/category`, `/product`)
  require login. `/signup` and `/login` redirect away if a session already exists.

## Price rule enforcement

New `backend/src/utils/serializeProduct.ts` — the chokepoint every product-serving route
must call, replacing the two hand-built response objects in `products.ts` today:

```typescript
export function serializeProduct(p: ProductWithCategory, includePrice: boolean) {
  return {
    code: p.code,
    name_ar: p.nameAr,
    name_en: p.nameEn,
    unit: p.unit,
    image_url: p.imageUrl || "",
    category_id: p.categoryId,
    category: p.category
      ? { name_ar: p.category.nameAr, name_en: p.category.nameEn, slug: p.category.slug }
      : null,
    ...(includePrice ? { price_jod: Number(p.priceJod) } : {}),
  };
}
```

`products.ts`'s list route and detail route both call this instead of building their own
object. `includePrice = req.user?.role !== "business"` — true for anonymous and personal
sessions, false only for a validated business session.

New `backend/src/middleware/authMiddleware.ts` — reads `Authorization: Bearer <token>` if
present, verifies it against Supabase's JWKS, looks up `profiles.role` by the token's
`sub` claim, and sets `req.user = { id, role }`. A missing, expired, or invalid token
leaves `req.user` unset; the request proceeds as anonymous rather than failing — no
existing public route becomes a 401 because of this phase.

## Infra migration (Docker Postgres → Supabase)

- Create the Supabase project.
- Point `DATABASE_URL` at the Supabase connection string — the same value for local dev
  and production, per the decision above.
- Run the existing Prisma migrations against it (`prisma migrate deploy`), then the new
  `profiles` migration and its `auth.users` trigger on top.
- Re-run the existing seed script (`data/categories.json` + `products.json`) against the
  Supabase database — same 26 categories / 632 products as today.
- `docker-compose.yml`: remove the local `postgres` service entirely; `backend` no longer
  `depends_on: postgres`; `DATABASE_URL` becomes a required env var (no localhost
  fallback).
- `.env.example` gains `SUPABASE_URL`, `SUPABASE_ANON_KEY` (used by both the frontend and
  the backend's token verification), and `SUPABASE_SERVICE_ROLE_KEY` (reserved for any
  server-side privileged operation — none identified yet, but worth having available).

## Testing

- A confirmed signup creates exactly one `profiles` row, with the correct role and
  fields, for both personal and business accounts.
- Anonymous and personal-role requests to `/api/products` and `/api/products/:code`
  include `price_jod`; business-role requests never include it — including through the
  `search` and `category_id` filter variants of the list endpoint.
- An expired or garbage bearer token results in anonymous (price-visible) behavior, not a
  500.
- A logged-in user cannot read another user's `profiles` row via a direct Supabase query
  (not just through Express) — proves the RLS policy holds independent of the app layer.
- Existing product/category tests keep passing after the database changes host.

## Open risks

- **JWT verification approach.** Supabase is transitioning from shared-secret (HS256) to
  asymmetric (JWKS-based) signing keys for project JWTs. The implementation plan should
  confirm which one the target project uses before writing `authMiddleware.ts`, since the
  verification code differs (shared secret vs. fetching/caching a JWKS).
- **Trigger reliability.** If the `auth.users` → `profiles` trigger fails silently for any
  reason (e.g. a metadata field missing), a confirmed user could exist with no profile
  row, and `req.user` would resolve oddly. Worth an explicit test for the missing-profile
  case, not just the happy path.
