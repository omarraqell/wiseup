/**
 * Categories API routes.
 *
 * GET /api/categories — list all categories with product counts.
 */
import { Router } from "express";
import { prisma } from "../utils/prisma";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { products: true } },
      },
    });

    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        name_ar: c.nameAr,
        name_en: c.nameEn,
        slug: c.slug,
        count: c._count.products,
      })),
    });
  } catch (err) {
    next(err);
  }
});
