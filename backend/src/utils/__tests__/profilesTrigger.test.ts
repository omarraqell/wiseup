import "dotenv/config"; // vitest does not auto-load .env — this reads backend/.env
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
