# WISEUP Phase 3 — Auth + Roles (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Postgres database to a Supabase-hosted project and add Supabase Auth with `personal`/`business` roles, so that business accounts never receive `price_jod` from any product-serving endpoint.

**Architecture:** Next.js frontend uses `@supabase/ssr` for signup/login/session; Express verifies the caller's Supabase-issued JWT via JWKS (no secret needed) and resolves their role from a new `profiles` table; a new `serializeProduct()` chokepoint in the Node backend (mirroring the existing pattern in `ai-service/catalog.py`) is the one place `price_jod` gets included or omitted.

**Tech Stack:** Next.js 16 (App Router, `src/` directory), Express + Prisma, Supabase (Postgres + Auth), `@supabase/ssr` + `@supabase/supabase-js` (frontend), `jose` (backend JWT verification), `vitest` + `supertest` (backend tests, newly introduced — no test runner exists in `backend/` today).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-21-wiseup-phase3-auth-roles-design.md` — every task below implements one section of it.
- Anonymous requests (no token, or an invalid/expired one) must never error. Missing/bad auth always resolves to "treat as anonymous" (full price visibility), never a 401/500.
- `serializeProduct()` is the **only** place `price_jod` may be added to a backend response. No route may hand-build a product JSON object (this replaces the current duplicated logic in `products.ts`).
- Local dev and production point at the **same** Supabase Postgres instance — no separate local Docker Postgres after this plan (per spec decision).
- **Never run `prisma db push`** against the Supabase database — it can silently drop hand-authored SQL (RLS policies, triggers, the cross-schema FK into `auth.users`) that `schema.prisma` doesn't model. Always use `prisma migrate dev --create-only`, hand-edit the generated SQL, then `prisma migrate deploy`.
- The backend needs **no Supabase secret key** for JWT verification — JWKS verification is public-key based. Only `SUPABASE_URL` is required server-side for this phase.
- The AI chat agent's price-awareness is explicitly out of scope for this plan (per user decision during brainstorming) — do not touch `ai-service/`.
- Existing `categories`, `products`, `chat_sessions`, `chat_messages`, `leads` tables keep their exact current shape — only their host changes.

---

## Task 1: Create the Supabase project

**Files:** none (infrastructure provisioning via the Supabase MCP tools)

**Interfaces:**
- Produces: a live Supabase project, its `project_id`, its API URL (`SUPABASE_URL`), and its publishable/anon key — all three are consumed by every later task.

This task creates a real, billable cloud resource. **Do not run this unattended** — confirm the project name and region with the user before calling `create_project`, even though the org is unambiguous (only one organization, "OMAR NEW", `hymizwmuyqhbvmieoebw`, exists on this account).

- [ ] **Step 1: Confirm project name and region with the user**

Suggest name `wiseup` and region `eu-central-1` (closest available region to Jordan in Supabase's region list), but get explicit confirmation — region cannot be changed later without recreating the project.

- [ ] **Step 2: Get and confirm the cost**

Call `get_cost` with `organization_id: "hymizwmuyqhbvmieoebw"`, `type: "project"`. Repeat the returned amount/recurrence to the user in plain language, then call `confirm_cost` with the same `type`, the `amount`, and `recurrence` from the response. Keep the returned confirmation id for Step 3.

- [ ] **Step 3: Create the project**

Call `create_project` with `name`, `region`, `organization_id: "hymizwmuyqhbvmieoebw"`, and `confirm_cost_id` from Step 2.

- [ ] **Step 4: Wait for it to become active**

Poll `get_project` with the returned `project_id` until its status is active (not still initializing). This can take a few minutes.

- [ ] **Step 5: Capture the API URL and publishable key**

Call `get_project_url` and `get_publishable_keys` with the `project_id`. Record:
- `SUPABASE_URL` = the returned project URL (e.g. `https://<project-ref>.supabase.co`)
- `SUPABASE_ANON_KEY` = the publishable/anon key from `get_publishable_keys` (prefer the modern `sb_publishable_...` key if present; the legacy JWT-format anon key also works)

- [ ] **Step 6: Capture the database password**

In the Supabase Dashboard for this project, go to **Project Settings → Database → Connection string**. Note the database password shown there (or reset it via **Reset Database Password** if it wasn't captured at creation time — resetting is safe, nothing depends on the old one yet). This password is needed for `DATABASE_URL` in Task 2 and is never committed to git.

- [ ] **Step 7: Record everything for the next task**

Keep `project_id`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the database password at hand — Task 2 writes them into `.env` (untracked).

---

## Task 2: Point Prisma at Supabase and re-migrate + reseed

**Files:**
- Modify: `.env` (untracked, not created by this plan — the developer's local copy)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `SUPABASE_URL`, database password, `project_id` from Task 1.
- Produces: a Supabase-hosted Postgres with the existing schema and seed data — every later backend task assumes this is done.

- [ ] **Step 1: Get the exact connection string**

In the Supabase Dashboard, **Project Settings → Database → Connection string**, select **URI** format and the **Session pooler** mode (works over both IPv4 and IPv6, unlike the direct connection). Copy it exactly — do not hand-construct it, the hostname format varies by region/pooler generation. Substitute in the database password from Task 1.

- [ ] **Step 2: Update `.env.example`**

Add to `.env.example`:

```
# Supabase — database + auth (Phase 3)
DATABASE_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- [ ] **Step 3: Update your local `.env`**

Set `DATABASE_URL` to the real connection string from Step 1, `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the values from Task 1. Leave `SUPABASE_SERVICE_ROLE_KEY` blank for now (reserved, unused this phase) unless Task 3's test needs it (it does — see Task 3).

- [ ] **Step 4: Apply existing migrations to Supabase**

Run:
```bash
cd backend
npx prisma migrate deploy
```
Expected: `1 migration found... Applying migration 20260718162621_init_migration... The following migration(s) have been applied: ...`. This creates `categories`, `products`, `chat_sessions`, `chat_messages`, `leads` in the Supabase Postgres, identical to what's in the local Docker Postgres today.

- [ ] **Step 5: Re-seed the catalog data**

Run:
```bash
cd backend
npx tsx prisma/seed.ts
```
Expected output ends with `Seeded 632 products successfully.` and `✨ Seeding completed successfully.`

- [ ] **Step 6: Verify via the Supabase MCP**

Call `list_tables` with the `project_id` and `schemas: ["public"]`. Expected: `categories` and `products` tables present. Then call `execute_sql` with `query: "select count(*) from products"` — expect `632`, and `"select count(*) from categories"` — expect `26`.

- [ ] **Step 7: Commit the `.env.example` change**

```bash
git add .env.example
git commit -m "docs: add Supabase env vars to .env.example"
```

---

## Task 3: Add the `profiles` table, RLS policy, and `auth.users` trigger

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_profiles/migration.sql` (timestamp assigned by Prisma when generated in Step 2)
- Test: `backend/src/utils/__tests__/profilesTrigger.test.ts` — requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` (get the service role key from **Project Settings → API** in the dashboard and add it to your local `.env` now)

**Interfaces:**
- Produces: `Profile` Prisma model (`id`, `role`, `name`, `phone`, `companyName`, `companyCity`, `companyType`, `createdAt`, `updatedAt`), auto-populated whenever a row is inserted into `auth.users`.

- [ ] **Step 1: Add the `Profile` model to `schema.prisma`**

Append to `backend/prisma/schema.prisma`:

```prisma
// ─── Profiles (Supabase Auth roles) ───────────────────────────────────

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

- [ ] **Step 2: Generate the migration file without applying it**

```bash
cd backend
npx prisma migrate dev --name add_profiles --create-only
```
Expected: a new folder `prisma/migrations/<timestamp>_add_profiles/migration.sql` containing a `CREATE TABLE "profiles" (...)` statement. Note the exact folder name it generated.

- [ ] **Step 3: Append RLS, the FK into `auth.users`, and the trigger**

Open the generated `migration.sql` and append this SQL to the end of the file (after the `CREATE TABLE` Prisma generated):

```sql
-- Foreign key into Supabase's auth.users, with cascade delete
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_fkey"
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Row Level Security: a user may only read/update their own profile
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON "profiles" FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON "profiles" FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create a profile row whenever a new auth.users row is inserted.
-- COALESCE defaults protect signup from failing outright if a metadata
-- field is ever missing (e.g. a future OAuth signup path with no custom data).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name, phone, company_name, company_city, company_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'personal'),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'company_city',
    NEW.raw_user_meta_data->>'company_type'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 4: Apply the migration**

```bash
cd backend
npx prisma migrate deploy
```
Expected: `Applying migration <timestamp>_add_profiles... The following migration(s) have been applied`.

- [ ] **Step 5: Regenerate the Prisma client**

```bash
cd backend
npx prisma generate
```
Expected: `✔ Generated Prisma Client`. This makes `prisma.profile` available in TypeScript.

- [ ] **Step 6: Add the Supabase service-role client dependency for the test**

```bash
cd backend
npm install @supabase/supabase-js
```

- [ ] **Step 7: Write the trigger integration test**

Create `backend/src/utils/__tests__/profilesTrigger.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../prisma";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let createdUserId: string | undefined;

afterEach(async () => {
  if (createdUserId) {
    await admin.auth.admin.deleteUser(createdUserId);
    createdUserId = undefined;
  }
});

describe("auth.users -> profiles trigger", () => {
  it("creates a matching profile row for a personal signup", async () => {
    const email = `test-personal-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "personal", name: "Test Person", phone: "0790000000" },
    });
    expect(error).toBeNull();
    createdUserId = data.user!.id;

    const profile = await prisma.profile.findUnique({ where: { id: createdUserId } });
    expect(profile).toMatchObject({
      id: createdUserId,
      role: "personal",
      name: "Test Person",
      phone: "0790000000",
      companyName: null,
    });
  });

  it("creates a matching profile row for a business signup, including company fields", async () => {
    const email = `test-business-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: {
        role: "business",
        name: "Test Biz Owner",
        phone: "0790000001",
        company_name: "Test Tools Co",
        company_city: "Amman",
        company_type: "Retailer",
      },
    });
    expect(error).toBeNull();
    createdUserId = data.user!.id;

    const profile = await prisma.profile.findUnique({ where: { id: createdUserId } });
    expect(profile).toMatchObject({
      role: "business",
      companyName: "Test Tools Co",
      companyCity: "Amman",
      companyType: "Retailer",
    });
  });

  it("deleting the auth user cascades to delete the profile row", async () => {
    const email = `test-cascade-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "personal", name: "Cascade Test" },
    });
    const userId = data.user!.id;

    await admin.auth.admin.deleteUser(userId);
    createdUserId = undefined; // already deleted, afterEach has nothing to do

    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    expect(profile).toBeNull();
  });
});
```

(This test runs against the real Supabase project set up in Task 1/2 — there's no local Postgres anymore per this plan's Global Constraints. It creates and deletes its own throwaway users, so it's safe to run repeatedly.)

- [ ] **Step 8: Run the test — expected to fail before vitest exists**

```bash
cd backend
npx vitest run src/utils/__tests__/profilesTrigger.test.ts
```
Expected: fails with "vitest: command not found" or similar — vitest isn't installed yet. This is expected; Task 4 installs it. Skip to Step 9 to confirm the trigger works via SQL directly instead, then come back and run this test for real once Task 4 lands vitest.

- [ ] **Step 9: Verify the trigger via `execute_sql` in the meantime**

Call `execute_sql` with `project_id` and:
```sql
select count(*) from information_schema.triggers where trigger_name = 'on_auth_user_created';
```
Expected: `1`.

- [ ] **Step 10: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/utils/__tests__/profilesTrigger.test.ts
git commit -m "feat: add profiles table with RLS and auth.users trigger"
```

---

## Task 4: Backend test runner + `authMiddleware`

**Files:**
- Create: `backend/vitest.config.ts`
- Create: `backend/src/types/express.d.ts`
- Create: `backend/src/middleware/authMiddleware.ts`
- Create: `backend/src/middleware/authMiddleware.test.ts`
- Modify: `backend/package.json` (add `vitest`, `jose`, `test` script)
- Modify: `backend/src/index.ts` (mount the middleware)

**Interfaces:**
- Produces: `req.user?: { id: string; role: string }` on every Express request; `authMiddleware(req, res, next)` (mounted globally); `verifyAndAttachUser(req, res, next, options?)` (the testable, dependency-injectable core).
- Consumes: `SUPABASE_URL` env var; `prisma.profile.findUnique` (from Task 3).

- [ ] **Step 1: Install dependencies**

```bash
cd backend
npm install jose
npm install -D vitest
```

- [ ] **Step 2: Add the test script and vitest config**

Add to `backend/package.json` scripts:
```json
"test": "vitest run"
```

Create `backend/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Add the `req.user` type augmentation**

Create `backend/src/types/express.d.ts`:
```typescript
declare namespace Express {
  export interface Request {
    user?: { id: string; role: string };
  }
}
```

- [ ] **Step 4: Write the failing test**

Create `backend/src/middleware/authMiddleware.test.ts`:
```typescript
import { describe, it, expect, vi, beforeAll } from "vitest";
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import type { Request, Response } from "express";
import { verifyAndAttachUser } from "./authMiddleware";
import { prisma } from "../utils/prisma";

vi.mock("../utils/prisma", () => ({
  prisma: { profile: { findUnique: vi.fn() } },
}));

const ISSUER = "https://test-project.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const KID = "test-key-1";
const USER_ID = "11111111-1111-1111-1111-111111111111";

describe("verifyAndAttachUser", () => {
  let jwks: ReturnType<typeof createLocalJWKSet>;
  let privateKey: CryptoKey;

  beforeAll(async () => {
    const { publicKey, privateKey: priv } = await generateKeyPair("RS256");
    privateKey = priv;
    const jwk = await exportJWK(publicKey);
    jwk.kid = KID;
    jwk.alg = "RS256";
    jwks = createLocalJWKSet({ keys: [jwk] });
  });

  function mockReqRes(authHeader?: string) {
    const req = { headers: { authorization: authHeader } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();
    return { req, res, next };
  }

  async function signToken(overrides: { exp?: string; issuer?: string; audience?: string } = {}) {
    return new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setSubject(USER_ID)
      .setIssuedAt()
      .setIssuer(overrides.issuer ?? ISSUER)
      .setAudience(overrides.audience ?? AUDIENCE)
      .setExpirationTime(overrides.exp ?? "1h")
      .sign(privateKey);
  }

  it("sets req.user for a valid token with a known profile", async () => {
    const token = await signToken();
    (prisma.profile.findUnique as any).mockResolvedValue({ id: USER_ID, role: "business" });

    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    await verifyAndAttachUser(req, res, next, { jwks, issuer: ISSUER, audience: AUDIENCE });

    expect(req.user).toEqual({ id: USER_ID, role: "business" });
    expect(next).toHaveBeenCalledOnce();
  });

  it("leaves req.user unset when there is no Authorization header", async () => {
    const { req, res, next } = mockReqRes(undefined);
    await verifyAndAttachUser(req, res, next, { jwks, issuer: ISSUER, audience: AUDIENCE });

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("leaves req.user unset for an expired token, without throwing", async () => {
    const token = await signToken({ exp: "-1h" });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await verifyAndAttachUser(req, res, next, { jwks, issuer: ISSUER, audience: AUDIENCE });

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("leaves req.user unset for a token with the wrong issuer", async () => {
    const token = await signToken({ issuer: "https://someone-else.supabase.co/auth/v1" });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await verifyAndAttachUser(req, res, next, { jwks, issuer: ISSUER, audience: AUDIENCE });

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
cd backend
npx vitest run src/middleware/authMiddleware.test.ts
```
Expected: FAIL — `Cannot find module './authMiddleware'`.

- [ ] **Step 6: Write `authMiddleware.ts`**

Create `backend/src/middleware/authMiddleware.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import { prisma } from "../utils/prisma";

const SUPABASE_URL = process.env.SUPABASE_URL || "";

const defaultJwks = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : undefined;

export interface VerifyOptions {
  jwks?: JWTVerifyGetKey;
  issuer?: string;
  audience?: string;
}

export async function verifyAndAttachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
  options: VerifyOptions = {}
) {
  const jwks = options.jwks ?? defaultJwks;
  const issuer = options.issuer ?? `${SUPABASE_URL}/auth/v1`;
  const audience = options.audience ?? "authenticated";

  req.user = undefined;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ") || !jwks) return next();

  const token = header.slice("Bearer ".length);
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience });
    const userId = payload.sub;
    if (!userId) return next();

    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    if (profile) req.user = { id: userId, role: profile.role };
  } catch {
    // invalid/expired/wrong-issuer token -> request proceeds as anonymous
  }
  next();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  void verifyAndAttachUser(req, res, next);
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd backend
npx vitest run src/middleware/authMiddleware.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 8: Mount the middleware in `index.ts`**

In `backend/src/index.ts`, add the import beside the router imports:
```typescript
import { authMiddleware } from "./middleware/authMiddleware";
```

Add right after `app.use(express.json());` (line 26) and before the route mounts:
```typescript
app.use(authMiddleware);
```

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/vitest.config.ts backend/src/types/express.d.ts backend/src/middleware/authMiddleware.ts backend/src/middleware/authMiddleware.test.ts backend/src/index.ts
git commit -m "feat: verify Supabase JWTs and resolve caller role via authMiddleware"
```

---

## Task 5: `serializeProduct()` chokepoint

**Files:**
- Create: `backend/src/utils/serializeProduct.ts`
- Create: `backend/src/utils/serializeProduct.test.ts`
- Modify: `backend/src/routes/products.ts`
- Create: `backend/src/routes/products.test.ts`
- Modify: `backend/package.json` (add `supertest`, `@types/supertest`)

**Interfaces:**
- Consumes: `req.user?.role` (from Task 4).
- Produces: `serializeProduct(p: ProductWithCategory, includePrice: boolean)` — every later product-serving route must call this, never hand-build a response.

- [ ] **Step 1: Install test dependency**

```bash
cd backend
npm install -D supertest @types/supertest
```

- [ ] **Step 2: Write the failing unit test for `serializeProduct`**

Create `backend/src/utils/serializeProduct.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { serializeProduct, type ProductWithCategory } from "./serializeProduct";

const PRODUCT: ProductWithCategory = {
  id: 1,
  code: "10101",
  nameAr: "زرادية",
  nameEn: "Pliers",
  unit: "pcs",
  priceJod: 2.5 as any,
  imageUrl: "/images/10101.png",
  isActive: true,
  categoryId: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { nameAr: "سلسلة الزراديات", nameEn: "Pliers series", slug: "pliers-series" },
};

describe("serializeProduct", () => {
  it("includes price_jod when includePrice is true", () => {
    const result = serializeProduct(PRODUCT, true);
    expect(result.price_jod).toBe(2.5);
  });

  it("omits price_jod entirely when includePrice is false", () => {
    const result = serializeProduct(PRODUCT, false);
    expect(result).not.toHaveProperty("price_jod");
  });

  it("keeps every non-price field regardless of includePrice", () => {
    const result = serializeProduct(PRODUCT, false);
    expect(result).toMatchObject({
      code: "10101",
      name_ar: "زرادية",
      name_en: "Pliers",
      unit: "pcs",
      image_url: "/images/10101.png",
      category_id: 5,
      category: { name_ar: "سلسلة الزراديات", name_en: "Pliers series", slug: "pliers-series" },
    });
  });

  it("returns category: null when the product has no category", () => {
    const result = serializeProduct({ ...PRODUCT, category: null }, true);
    expect(result.category).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd backend
npx vitest run src/utils/serializeProduct.test.ts
```
Expected: FAIL — `Cannot find module './serializeProduct'`.

- [ ] **Step 4: Write `serializeProduct.ts`**

Create `backend/src/utils/serializeProduct.ts`:
```typescript
import type { Product, Category } from "@prisma/client";

export type ProductWithCategory = Product & {
  category: Pick<Category, "nameAr" | "nameEn" | "slug"> | null;
};

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

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd backend
npx vitest run src/utils/serializeProduct.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing route-wiring test**

Create `backend/src/routes/products.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { productsRouter } from "./products";
import { prisma } from "../utils/prisma";

vi.mock("../utils/prisma", () => ({
  prisma: {
    product: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  },
}));

function appWithUser(user?: { id: string; role: string }) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use("/api/products", productsRouter);
  return app;
}

const PRODUCT = {
  id: 1,
  code: "10101",
  nameAr: "زرادية",
  nameEn: "Pliers",
  unit: "pcs",
  priceJod: 2.5,
  imageUrl: "/images/10101.png",
  isActive: true,
  categoryId: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { nameAr: "سلسلة الزراديات", nameEn: "Pliers series", slug: "pliers-series" },
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.product.findMany as any).mockResolvedValue([PRODUCT]);
  (prisma.product.count as any).mockResolvedValue(1);
  (prisma.product.findUnique as any).mockResolvedValue(PRODUCT);
});

describe("GET /api/products", () => {
  it("includes price_jod for an anonymous caller", async () => {
    const res = await request(appWithUser(undefined)).get("/api/products");
    expect(res.body.products[0].price_jod).toBe(2.5);
  });

  it("includes price_jod for a personal-role caller", async () => {
    const res = await request(appWithUser({ id: "u1", role: "personal" })).get("/api/products");
    expect(res.body.products[0].price_jod).toBe(2.5);
  });

  it("omits price_jod for a business-role caller", async () => {
    const res = await request(appWithUser({ id: "u1", role: "business" })).get("/api/products");
    expect(res.body.products[0]).not.toHaveProperty("price_jod");
  });
});

describe("GET /api/products/:code", () => {
  it("omits price_jod for a business-role caller", async () => {
    const res = await request(appWithUser({ id: "u1", role: "business" })).get("/api/products/10101");
    expect(res.body).not.toHaveProperty("price_jod");
  });

  it("includes price_jod for an anonymous caller", async () => {
    const res = await request(appWithUser(undefined)).get("/api/products/10101");
    expect(res.body.price_jod).toBe(2.5);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
cd backend
npx vitest run src/routes/products.test.ts
```
Expected: FAIL — business-role test fails because `products.ts` still always includes `price_jod`.

- [ ] **Step 8: Rewrite `products.ts` to use `serializeProduct`**

Replace the full contents of `backend/src/routes/products.ts`:
```typescript
/**
 * Products API routes.
 *
 * GET  /api/products           — list products (optional filters: category_id, search, page, limit)
 * GET  /api/products/:code     — get single product by code
 */
import { Router } from "express";
import { prisma } from "../utils/prisma";
import { serializeProduct } from "../utils/serializeProduct";

export const productsRouter = Router();

// List products with optional filtering and pagination
productsRouter.get("/", async (req, res, next) => {
  try {
    const categoryId = req.query.category_id ? parseInt(req.query.category_id as string, 10) : undefined;
    const search = (req.query.search as string) || undefined;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { nameAr: { contains: search, mode: "insensitive" } },
        { nameEn: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: "asc" },
        include: { category: { select: { nameAr: true, nameEn: true, slug: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    const includePrice = req.user?.role !== "business";

    res.json({
      products: products.map((p) => serializeProduct(p, includePrice)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// Get single product by code
productsRouter.get("/:code", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { code: req.params.code },
      include: { category: { select: { nameAr: true, nameEn: true, slug: true } } },
    });

    if (!product) {
      return res.status(404).json({ error: { message: "Product not found" } });
    }

    const includePrice = req.user?.role !== "business";
    res.json(serializeProduct(product, includePrice));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
cd backend
npx vitest run src/routes/products.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 10: Run the full backend test suite**

```bash
cd backend
npm test
```
Expected: all tests across `authMiddleware.test.ts`, `serializeProduct.test.ts`, `products.test.ts` pass (13 tests). (`profilesTrigger.test.ts` from Task 3 also runs here now that vitest exists — confirm it passes too, using the real Supabase project.)

- [ ] **Step 11: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/utils/serializeProduct.ts backend/src/utils/serializeProduct.test.ts backend/src/routes/products.ts backend/src/routes/products.test.ts
git commit -m "feat: route product responses through a single price-aware serializer"
```

---

## Task 6: Frontend Supabase clients + session-refresh proxy

**Files:**
- Create: `frontend/src/lib/supabase/client.ts`
- Create: `frontend/src/lib/supabase/server.ts`
- Create: `frontend/src/lib/supabase/proxy.ts`
- Create: `frontend/proxy.ts` (project root — Next.js 16 renamed `middleware.ts` to `proxy.ts`; confirmed against the currently-installed Next.js 16.2.10 via Supabase's own docs)
- Modify: `frontend/package.json` (add `@supabase/ssr`, `@supabase/supabase-js`)
- Modify: `.env.example` (frontend-visible vars)

**Interfaces:**
- Produces: `createClient()` (browser, in `lib/supabase/client.ts`), `createClient()` (server/async, in `lib/supabase/server.ts`) — both consumed by every frontend auth task after this one.

**Test:** manual (no UI exists yet to exercise this against — verified in Task 8 once the Header renders auth state).

- [ ] **Step 1: Install dependencies**

```bash
cd frontend
npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Add frontend env vars**

Add to `.env.example` (repo root):
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
Add the same two keys, with real values from Task 1, to your local `.env`.

- [ ] **Step 3: Write the browser client**

Create `frontend/src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Write the server client**

Create `frontend/src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; the proxy below refreshes sessions instead.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5: Write the session-refresh logic**

Create `frontend/src/lib/supabase/proxy.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not add code between createServerClient and getClaims() — a mistake
  // here can cause users to be randomly logged out.
  await supabase.auth.getClaims();

  return response;
}
```

- [ ] **Step 6: Wire up the project-root `proxy.ts`**

Create `frontend/proxy.ts`:
```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 7: Verify it doesn't break the running app**

```bash
cd frontend
npm run build
```
Expected: build succeeds with no errors about `proxy.ts` or missing env vars (this only checks compilation — the actual session refresh is verified once login exists, in Task 8).

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/supabase frontend/proxy.ts .env.example
git commit -m "feat: add Supabase browser/server clients and session-refresh proxy"
```

---

## Task 7: Email confirmation + password recovery route

**Files:**
- Create: `frontend/src/app/auth/confirm/route.ts`
- Create: `frontend/src/app/error/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `frontend/src/lib/supabase/server.ts` (Task 6).
- Produces: `GET /auth/confirm?token_hash=...&type=...&next=...` — the landing URL both the "Confirm signup" and "Reset Password" emails must point to.

**Test:** manual (no way to unit-test an email link land page without a live email — verified end-to-end in Task 13).

- [ ] **Step 1: Write the confirm route handler**

Create `frontend/src/app/auth/confirm/route.ts`:
```typescript
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  const errorRedirect = request.nextUrl.clone();
  errorRedirect.pathname = "/error";
  errorRedirect.search = "";
  return NextResponse.redirect(errorRedirect);
}
```

- [ ] **Step 2: Write a minimal error landing page**

Create `frontend/src/app/error/page.tsx`:
```tsx
export default function ErrorPage() {
  return (
    <div className="max-w-md mx-auto py-24 px-6 text-center">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-4">
        Something went wrong
      </h1>
      <p className="text-[#5e3f3b]">
        This link may have expired or already been used. Try signing up or
        resetting your password again.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Update the Supabase email templates**

In the Supabase Dashboard, **Authentication → Email Templates**:

- **Confirm signup** template: replace `{{ .ConfirmationURL }}` with
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- **Reset Password** template: replace `{{ .ConfirmationURL }}` with
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

- [ ] **Step 4: Set the allowed redirect URLs**

In the Supabase Dashboard, **Authentication → URL Configuration**:
- Set **Site URL** to `http://localhost:3100` for local dev.
- Add `http://localhost:3100/**` to **Redirect URLs**.

- [ ] **Step 5: Verify it compiles**

```bash
cd frontend
npm run build
```
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/auth frontend/src/app/error
git commit -m "feat: add email confirmation and password-recovery landing route"
```

---

## Task 8: `AuthContext` + Header integration

**Files:**
- Create: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/components/Header.tsx`

**Interfaces:**
- Consumes: `createClient()` (browser) from Task 6.
- Produces: `useAuth() -> { user, role, loading, signOut }` — consumed by Header now, and by the signup/login pages in Tasks 9–10 to redirect already-logged-in visitors.

**Test:** manual (browser) — this is UI state wiring, consistent with how `frontend/CLAUDE.md`'s referenced conventions and the original Phase 2 plan treated other client-side UI wiring.

- [ ] **Step 1: Write `AuthContext.tsx`**

Create `frontend/src/context/AuthContext.tsx`:
```tsx
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setRole((session?.user?.user_metadata?.role as string) ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setRole((session?.user?.user_metadata?.role as string) ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

Note: `role` here is read from client-side `user_metadata` for display purposes only (the header badge) — it is **not** a security boundary. The real enforcement is server-side in `authMiddleware` + `profiles` (Task 4/5), which never trusts this value.

- [ ] **Step 2: Wrap the app with `AuthProvider`**

In `frontend/src/app/layout.tsx`, add the import:
```typescript
import { AuthProvider } from "@/context/AuthContext";
```

Wrap the existing `<LanguageProvider>` content with it — replace:
```tsx
        <LanguageProvider>
          <Header />
          <main className="flex-grow w-full">{children}</main>
          <Footer />
        </LanguageProvider>
```
with:
```tsx
        <AuthProvider>
          <LanguageProvider>
            <Header />
            <main className="flex-grow w-full">{children}</main>
            <Footer />
          </LanguageProvider>
        </AuthProvider>
```

- [ ] **Step 3: Add auth-aware actions to the Header**

In `frontend/src/components/Header.tsx`, add the imports:
```typescript
import { useAuth } from "@/context/AuthContext";
```

Add inside the component, alongside the existing `useLanguage()` call:
```typescript
  const { user, role, loading, signOut } = useAuth();
```

In the "Trailing Actions" div (currently holding the language toggle, cart, and hamburger buttons), add this block right before the language-toggle button:
```tsx
          {!loading && (
            user ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-sm font-medium text-[#5e3f3b]">
                  {role === "business" ? t("حساب تجاري", "Business") : t("حسابي", "My Account")}
                </span>
                <button
                  onClick={signOut}
                  className={buttonClass}
                  title={t("تسجيل الخروج", "Log out")}
                >
                  <span className="material-symbols-outlined">logout</span>
                </button>
              </div>
            ) : (
              <Link href="/login" className={`${buttonClass} text-sm font-medium px-3`}>
                {t("تسجيل الدخول", "Log in")}
              </Link>
            )
          )}
```

- [ ] **Step 4: Manually verify in the browser**

```bash
cd frontend
npm run dev
```
Open `http://localhost:3000` (or whatever port `npm run dev` reports). Expected: header shows a "Log in" link (since no session exists yet). No console errors about `useAuth` or missing provider.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/AuthContext.tsx frontend/src/app/layout.tsx frontend/src/components/Header.tsx
git commit -m "feat: add AuthContext and wire logged-in/out state into the header"
```

---

## Task 9: `/signup` page

**Files:**
- Create: `frontend/src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (browser, Task 6), `useLanguage()` (existing).

**Test:** manual (browser).

- [ ] **Step 1: Write the signup page**

Create `frontend/src/app/signup/page.tsx`:
```tsx
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

type Role = "personal" | "business";

export default function SignupPage() {
  const { t } = useLanguage();
  const [role, setRole] = useState<Role>("personal");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          name,
          phone,
          ...(role === "business"
            ? { company_name: companyName, company_city: companyCity, company_type: companyType }
            : {}),
        },
      },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <h1 className="font-[Oswald] text-2xl text-brand-red mb-4">
          {t("تحقق من بريدك الإلكتروني", "Check your email")}
        </h1>
        <p className="text-[#5e3f3b]">
          {t(
            "أرسلنا رابط تأكيد إلى بريدك الإلكتروني. الرجاء النقر عليه لتفعيل حسابك.",
            "We sent a confirmation link to your email. Click it to activate your account."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16 px-6">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-6">
        {t("إنشاء حساب", "Create an account")}
      </h1>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setRole("personal")}
          className={`flex-1 py-2 rounded font-[Oswald] ${role === "personal" ? "bg-brand-red text-white" : "bg-[#F5F5F5] text-[#5e3f3b]"}`}
        >
          {t("شخصي", "Personal")}
        </button>
        <button
          type="button"
          onClick={() => setRole("business")}
          className={`flex-1 py-2 rounded font-[Oswald] ${role === "business" ? "bg-brand-red text-white" : "bg-[#F5F5F5] text-[#5e3f3b]"}`}
        >
          {t("شركة", "Business")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder={t("البريد الإلكتروني", "Email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder={t("كلمة المرور", "Password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          required
          placeholder={t("الاسم", "Name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="tel"
          placeholder={t("الهاتف", "Phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border rounded px-3 py-2"
        />

        {role === "business" && (
          <>
            <input
              type="text"
              required
              placeholder={t("اسم الشركة", "Company name")}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <input
              type="text"
              required
              placeholder={t("المدينة", "City")}
              value={companyCity}
              onChange={(e) => setCompanyCity(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <input
              type="text"
              required
              placeholder={t("نوع النشاط", "Business type")}
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-brand-red text-white rounded py-2 font-[Oswald] disabled:opacity-50"
        >
          {loading ? t("جارٍ الإنشاء...", "Creating...") : t("إنشاء حساب", "Create account")}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#5e3f3b]">
        {t("لديك حساب بالفعل؟", "Already have an account?")}{" "}
        <Link href="/login" className="text-brand-red font-medium">
          {t("تسجيل الدخول", "Log in")}
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify both roles in the browser**

```bash
cd frontend
npm run dev
```
Visit `/signup`. Toggle to "Business" — confirm the three company fields appear. Submit a real test email for each role once (personal, then business) and confirm the "Check your email" screen shows, and that a confirmation email actually arrives (from Supabase's default email sending — no custom SMTP needed for this).

- [ ] **Step 3: Verify the `profiles` row via the Supabase MCP**

After clicking the confirmation link, call `execute_sql` with `project_id` and:
```sql
select id, role, name, phone, company_name from profiles order by created_at desc limit 2;
```
Expected: one row per test signup, `role` and fields matching what was entered.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/signup
git commit -m "feat: add signup page with personal/business role toggle"
```

---

## Task 10: `/login`, `/forgot-password`, `/reset-password` pages

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/forgot-password/page.tsx`
- Create: `frontend/src/app/reset-password/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (browser, Task 6); `/auth/confirm` route (Task 7) for the recovery link's landing.

**Test:** manual (browser).

- [ ] **Step 1: Write the login page**

Create `frontend/src/app/login/page.tsx`:
```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto py-16 px-6">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-6">
        {t("تسجيل الدخول", "Log in")}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder={t("البريد الإلكتروني", "Email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder={t("كلمة المرور", "Password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-brand-red text-white rounded py-2 font-[Oswald] disabled:opacity-50"
        >
          {loading ? t("جارٍ الدخول...", "Logging in...") : t("تسجيل الدخول", "Log in")}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#5e3f3b]">
        <Link href="/forgot-password" className="text-brand-red font-medium">
          {t("نسيت كلمة المرور؟", "Forgot password?")}
        </Link>
      </p>
      <p className="mt-2 text-sm text-[#5e3f3b]">
        {t("ليس لديك حساب؟", "Don't have an account?")}{" "}
        <Link href="/signup" className="text-brand-red font-medium">
          {t("إنشاء حساب", "Sign up")}
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write the forgot-password page**

Create `frontend/src/app/forgot-password/page.tsx`:
```tsx
"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <h1 className="font-[Oswald] text-2xl text-brand-red mb-4">
          {t("تحقق من بريدك الإلكتروني", "Check your email")}
        </h1>
        <p className="text-[#5e3f3b]">
          {t(
            "أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.",
            "We sent a password reset link to your email."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16 px-6">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-6">
        {t("إعادة تعيين كلمة المرور", "Reset your password")}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder={t("البريد الإلكتروني", "Email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-brand-red text-white rounded py-2 font-[Oswald] disabled:opacity-50"
        >
          {loading ? t("جارٍ الإرسال...", "Sending...") : t("إرسال رابط إعادة التعيين", "Send reset link")}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Write the reset-password page**

Create `frontend/src/app/reset-password/page.tsx`:
```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/"), 1500);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <h1 className="font-[Oswald] text-2xl text-brand-red mb-4">
          {t("تم تحديث كلمة المرور", "Password updated")}
        </h1>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16 px-6">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-6">
        {t("كلمة مرور جديدة", "New password")}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="password"
          required
          minLength={6}
          placeholder={t("كلمة المرور الجديدة", "New password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-brand-red text-white rounded py-2 font-[Oswald] disabled:opacity-50"
        >
          {loading ? t("جارٍ التحديث...", "Updating...") : t("تحديث كلمة المرور", "Update password")}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

```bash
cd frontend
npm run dev
```
- Log in with the personal test account from Task 9. Expected: redirected to `/`, header now shows "My Account" + logout icon instead of "Log in".
- Log in with the business test account. Expected: header shows "Business" instead of "My Account".
- Click logout. Expected: header reverts to "Log in".
- Go through `/forgot-password` with the personal test account's email, click the emailed link, land on `/reset-password`, set a new password, confirm you're redirected to `/` and can log in again with the new password.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/login frontend/src/app/forgot-password frontend/src/app/reset-password
git commit -m "feat: add login, forgot-password, and reset-password pages"
```

---

## Task 11: Wire the caller's session into API requests

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: `createClient()` (browser, Task 6).
- Produces: every `getProducts`/`getProduct` call now sends `Authorization: Bearer <token>` when a session exists, so the backend's `authMiddleware` (Task 4) can resolve the caller's role.

**Test:** manual (browser network tab) — `ProductCard.tsx` and `product/page.tsx` already render `price_jod` conditionally (`product.price_jod != null ? ... : ""`), so no UI changes are needed there once the type and the header wiring are correct.

- [ ] **Step 1: Fix the `Product` type**

In `frontend/src/lib/api.ts`, change:
```typescript
export interface Product {
  code: string;
  name_ar: string;
  name_en: string | null;
  unit: string;
  price_jod: number;
  image_url: string;
  category_id: number | null;
  category: { name_ar: string; name_en: string; slug: string } | null;
}
```
to:
```typescript
export interface Product {
  code: string;
  name_ar: string;
  name_en: string | null;
  unit: string;
  price_jod?: number;
  image_url: string;
  category_id: number | null;
  category: { name_ar: string; name_en: string; slug: string } | null;
}
```

- [ ] **Step 2: Add the auth header helper**

Add the import at the top of `frontend/src/lib/api.ts`:
```typescript
import { createClient } from "@/lib/supabase/client";
```

Add this function right after `fetchJSON`:
```typescript
async function authHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}
```

- [ ] **Step 3: Attach the header to product requests**

Change `getProducts`:
```typescript
export async function getProducts(params?: {
  category_id?: number;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ProductsResponse> {
  const qs = new URLSearchParams();
  if (params?.category_id) qs.set("category_id", String(params.category_id));
  if (params?.search) qs.set("search", params.search);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  return fetchJSON<ProductsResponse>(`${API_BASE}/api/products${query}`, {
    headers: await authHeaders(),
  });
}
```

And `getProduct`:
```typescript
export async function getProduct(code: string): Promise<Product> {
  return fetchJSON<Product>(`${API_BASE}/api/products/${encodeURIComponent(code)}`, {
    headers: await authHeaders(),
  });
}
```

- [ ] **Step 4: Manually verify in the browser**

```bash
cd frontend
npm run dev
```
Log in as the business test account, open DevTools → Network, visit `/catalog`. Find the `/api/products` request — confirm its `Authorization` header is present and its JSON response has no `price_jod` key on any product. Log out, reload `/catalog` — confirm `price_jod` is back and no `Authorization` header is sent.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: send the caller's Supabase session token on product API requests"
```

---

## Task 12: Retire the local Postgres container

**Files:**
- Modify: `docker-compose.yml`

**Interfaces:** none — this only removes infrastructure that Task 2 already made redundant.

- [ ] **Step 1: Rewrite `docker-compose.yml`**

Replace the full contents of `docker-compose.yml`:
```yaml
services:
  backend:
    build: ./backend
    container_name: wiseup-api
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: development
      PORT: 4000
      DATABASE_URL: ${DATABASE_URL}
      SUPABASE_URL: ${SUPABASE_URL}
      AI_SERVICE_URL: http://ai-service:8000
      GMAIL_APP_PASSWORD: ${GMAIL_APP_PASSWORD}
    volumes:
      - ./backend/src:/app/src
      - ./images:/app/images
    restart: unless-stopped

  ai-service:
    build: ./ai-service
    container_name: wiseup-ai
    ports:
      - "8000:8000"
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      TAVILY_API_KEY: ${TAVILY_API_KEY}
      GMAIL_APP_PASSWORD: ${GMAIL_APP_PASSWORD}
      WISEUP_EMBED_BACKEND: openai
      LANGSMITH_TRACING: ${LANGSMITH_TRACING:-false}
      LANGSMITH_API_KEY: ${LANGSMITH_API_KEY:-}
      LANGSMITH_PROJECT: wiseup
    volumes:
      - chroma_data:/app/chroma_db_openai
    restart: unless-stopped

  frontend:
    build: ./frontend
    container_name: wiseup-web
    ports:
      - "3100:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
      NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  chroma_data:
```

This removes the `postgres` service, the `pg_data` volume, `backend`'s `depends_on: postgres`, and the obsolete top-level `version:` key (Docker already warns this is ignored).

- [ ] **Step 2: Rebuild and start the stack**

```bash
docker compose down
docker compose up -d --build
```
Expected: only `wiseup-api`, `wiseup-ai`, `wiseup-web` containers start — no `wiseup-db`.

- [ ] **Step 3: Smoke-test the backend against Supabase**

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/products?limit=2
```
Expected: `{"status":"ok",...}` and a JSON body with 2 products including `price_jod` (anonymous request).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: retire local Postgres container now that Supabase hosts the database"
```

---

## Task 13: Final verification

**Files:** none — this task only runs checks.

- [ ] **Step 1: Run the backend test suite**

```bash
cd backend
npm test
```
Expected: all tests pass (13+ tests across `authMiddleware`, `serializeProduct`, `products`, `profilesTrigger`).

- [ ] **Step 2: Run the existing Python test suite to confirm no regression**

```bash
python -m pytest -q
```
Expected: same pass count as the Phase 1/2 baseline (34 passed, 1 skipped) — this phase never touched `ai-service/`.

- [ ] **Step 3: Check Supabase security advisors**

Call `get_advisors` with `project_id` and `type: "security"`. Expected: no advisory about the `profiles` table missing RLS (Task 3 already enabled it). Note any other advisories surfaced and decide with the user whether they're in scope for this phase or a follow-up.

- [ ] **Step 4: End-to-end smoke test against the real stack**

With the Docker stack running (Task 12):
1. Sign up a fresh business test account through the running frontend, confirm the email, log in.
2. In the browser DevTools Network tab, confirm `/api/products` responses have no `price_jod`.
3. Log out, confirm `/api/products` responses have `price_jod` again (anonymous).
4. Sign up a fresh personal test account, log in, confirm `/api/products` responses have `price_jod`.
5. Send a garbage `Authorization: Bearer not-a-real-token` header via `curl http://localhost:4000/api/products -H "Authorization: Bearer not-a-real-token"` — expect HTTP 200 with `price_jod` present (anonymous fallback, not a 500).

- [ ] **Step 5: Report results to the user**

Summarize: test counts, advisories found, and confirmation that all five smoke-test steps passed. Do not mark the phase complete if any step failed — return to the relevant task instead.

---

## Self-Review Notes

- **Spec coverage:** every section of the spec (identity provider, DB hosting, anonymous browsing, business signup form, email confirmation, price-rule enforcement mechanism, data model, migration, testing) maps to a task above (Tasks 1–2 → infra decisions; Task 3 → data model; Tasks 4–5 → price rule; Tasks 6–11 → auth & frontend flows; Task 12 → infra migration; Task 13 → the spec's testing section).
- **Type consistency checked:** `req.user` (`{ id: string; role: string }`) is defined once in `express.d.ts` (Task 4) and used identically in `authMiddleware.ts`, `products.ts`, and both test files. `ProductWithCategory` is defined once in `serializeProduct.ts` (Task 5) and reused by its test. `createClient()` naming is consistent across `lib/supabase/client.ts` and `lib/supabase/server.ts` (Task 6), matching every later import (`AuthContext.tsx`, `api.ts`, all page files).
- **No placeholders:** all code blocks are complete; the one open-ended item (Prisma's auto-generated migration timestamp in Task 3) is inherent to how the tool works, not a deferred decision.
