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
