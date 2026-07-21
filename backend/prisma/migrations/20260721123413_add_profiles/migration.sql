-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "company_name" TEXT,
    "company_city" TEXT,
    "company_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- Give updated_at a DB-level default matching created_at. Prisma's @updatedAt
-- attribute is enforced client-side on prisma writes, but the auth.users
-- trigger below inserts via raw SQL and never goes through the Prisma client,
-- so without this default every signup would fail with a NOT NULL violation.
ALTER TABLE "profiles" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

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
