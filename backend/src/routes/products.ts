/**
 * Products API routes.
 *
 * GET  /api/products           — list products (optional filters: category_id, search, page, limit)
 * GET  /api/products/:code     — get single product by code
 */
import { Router } from "express";
import { prisma } from "../utils/prisma";

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

    res.json({
      products: products.map((p) => ({
        code: p.code,
        name_ar: p.nameAr,
        name_en: p.nameEn,
        unit: p.unit,
        price_jod: Number(p.priceJod),
        image_url: p.imageUrl || "",
        category_id: p.categoryId,
        category: p.category
          ? { name_ar: p.category.nameAr, name_en: p.category.nameEn, slug: p.category.slug }
          : null,
      })),
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

    res.json({
      code: product.code,
      name_ar: product.nameAr,
      name_en: product.nameEn,
      unit: product.unit,
      price_jod: Number(product.priceJod),
      image_url: product.imageUrl || "",
      category_id: product.categoryId,
      category: product.category
        ? { name_ar: product.category.nameAr, name_en: product.category.nameEn, slug: product.category.slug }
        : null,
    });
  } catch (err) {
    next(err);
  }
});
