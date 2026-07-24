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
