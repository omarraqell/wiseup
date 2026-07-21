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
