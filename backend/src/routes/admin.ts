import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeProduct } from "../utils/serializeProduct";

export const adminRouter = Router();

// Middleware to check if user is admin
const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: { message: "Unauthorized: Please log in first." } });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: { message: "Access denied: Admin role required." } });
  }

  next();
};

// Dev-friendly endpoint to promote any logged-in user to admin
adminRouter.post("/make-admin", async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: { message: "You must be logged in to promote yourself to admin." } });
    }

    const updatedProfile = await prisma.profile.update({
      where: { id: req.user.id },
      data: { role: "admin" },
    });

    res.json({
      message: "Successfully promoted to admin!",
      profile: {
        id: updatedProfile.id,
        name: updatedProfile.name,
        role: updatedProfile.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Analytics Stats ────────────────────────────────────────────────
adminRouter.get("/stats", requireAdmin, async (req, res, next) => {
  try {
    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      totalCategories,
      totalLeads,
      leadsGrouped,
      leadsPotentialSum,
      categoryProductCounts,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: false } }),
      prisma.category.count(),
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.lead.aggregate({
        _sum: { totalJod: true },
      }),
      prisma.category.findMany({
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          _count: { select: { products: true } },
        },
      }),
    ]);

    const statusBreakdown = {
      new: 0,
      contacted: 0,
      emailed: 0,
    };
    leadsGrouped.forEach((group) => {
      const status = group.status as keyof typeof statusBreakdown;
      if (status in statusBreakdown) {
        statusBreakdown[status] = group._count.id;
      }
    });

    res.json({
      products: {
        total: totalProducts,
        active: activeProducts,
        inactive: inactiveProducts,
      },
      categories: {
        total: totalCategories,
        distribution: categoryProductCounts.map((c) => ({
          id: c.id,
          name_ar: c.nameAr,
          name_en: c.nameEn,
          count: c._count.products,
        })),
      },
      leads: {
        total: totalLeads,
        potential_value_jod: Number(leadsPotentialSum._sum.totalJod || 0),
        status_breakdown: statusBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Products CRUD ──────────────────────────────────────────────────
adminRouter.get("/products", requireAdmin, async (req, res, next) => {
  try {
    const search = (req.query.search as string) || undefined;
    const categoryId = req.query.category_id ? parseInt(req.query.category_id as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    const image = req.query.image as string | undefined;
    const rawMinPrice = req.query.min_price ? Number(req.query.min_price) : undefined;
    const rawMaxPrice = req.query.max_price ? Number(req.query.max_price) : undefined;
    const minPrice = rawMinPrice !== undefined && Number.isFinite(rawMinPrice) ? rawMinPrice : undefined;
    const maxPrice = rawMaxPrice !== undefined && Number.isFinite(rawMaxPrice) ? rawMaxPrice : undefined;
    const sort = (req.query.sort as string) || "code_asc";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;
    if (image === "with") {
      where.AND = [{ imageUrl: { not: null } }, { imageUrl: { not: "" } }];
    }
    if (image === "without") {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: [{ imageUrl: null }, { imageUrl: "" }] }];
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.priceJod = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
    }
    if (search) {
      where.OR = [
        { nameAr: { contains: search, mode: "insensitive" } },
        { nameEn: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const sortOptions: Record<string, Prisma.ProductOrderByWithRelationInput> = {
      code_asc: { code: "asc" },
      code_desc: { code: "desc" },
      price_asc: { priceJod: "asc" },
      price_desc: { priceJod: "desc" },
      name_asc: { nameEn: "asc" },
      newest: { createdAt: "desc" },
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortOptions[sort] || sortOptions.code_asc,
        include: { category: { select: { nameAr: true, nameEn: true, slug: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map((p) => serializeProduct(p as any, true)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/products", requireAdmin, async (req, res, next) => {
  try {
    const { code, name_ar, name_en, unit, price_jod, category_id, image_url, is_active } = req.body;

    if (!code || !name_ar || price_jod === undefined) {
      return res.status(400).json({ error: { message: "Product code, name_ar, and price_jod are required." } });
    }

    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ error: { message: `Product with code '${code}' already exists.` } });
    }

    const product = await prisma.product.create({
      data: {
        code,
        nameAr: name_ar,
        nameEn: name_en || null,
        unit: unit || "pcs",
        priceJod: price_jod,
        categoryId: category_id ? parseInt(category_id, 10) : null,
        imageUrl: image_url || null,
        isActive: is_active !== false,
      },
      include: { category: { select: { nameAr: true, nameEn: true, slug: true } } },
    });

    res.status(201).json(serializeProduct(product as any, true));
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/products/:code", requireAdmin, async (req, res, next) => {
  try {
    const { code } = req.params;
    const { name_ar, name_en, unit, price_jod, category_id, image_url, is_active } = req.body;

    const existing = await prisma.product.findUnique({ where: { code } });
    if (!existing) {
      return res.status(404).json({ error: { message: "Product not found" } });
    }

    const updated = await prisma.product.update({
      where: { code },
      data: {
        nameAr: name_ar !== undefined ? name_ar : existing.nameAr,
        nameEn: name_en !== undefined ? name_en : existing.nameEn,
        unit: unit !== undefined ? unit : existing.unit,
        priceJod: price_jod !== undefined ? price_jod : existing.priceJod,
        categoryId: category_id !== undefined ? (category_id ? parseInt(category_id, 10) : null) : existing.categoryId,
        imageUrl: image_url !== undefined ? image_url : existing.imageUrl,
        isActive: is_active !== undefined ? is_active : existing.isActive,
      },
      include: { category: { select: { nameAr: true, nameEn: true, slug: true } } },
    });

    res.json(serializeProduct(updated as any, true));
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/products/:code", requireAdmin, async (req, res, next) => {
  try {
    const { code } = req.params;
    const existing = await prisma.product.findUnique({ where: { code } });
    if (!existing) {
      return res.status(404).json({ error: { message: "Product not found" } });
    }

    await prisma.product.delete({ where: { code } });
    res.json({ message: `Product with code '${code}' successfully deleted.` });
  } catch (err) {
    next(err);
  }
});

// ─── Categories CRUD ────────────────────────────────────────────────
adminRouter.get("/categories", requireAdmin, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });

    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        name_ar: c.nameAr,
        name_en: c.nameEn,
        slug: c.slug,
        sort_order: c.sortOrder,
        count: c._count.products,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/categories", requireAdmin, async (req, res, next) => {
  try {
    const { name_ar, name_en, slug, sort_order } = req.body;

    if (!name_ar || !name_en || !slug) {
      return res.status(400).json({ error: { message: "Arabic name, English name, and slug are required." } });
    }

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ error: { message: `Category slug '${slug}' is already in use.` } });
    }

    const category = await prisma.category.create({
      data: {
        nameAr: name_ar,
        nameEn: name_en,
        slug,
        sortOrder: sort_order !== undefined ? parseInt(sort_order, 10) : 0,
      },
    });

    res.status(201).json({
      id: category.id,
      name_ar: category.nameAr,
      name_en: category.nameEn,
      slug: category.slug,
      sort_order: category.sortOrder,
      count: 0,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/categories/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name_ar, name_en, slug, sort_order } = req.body;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { message: "Category not found" } });
    }

    if (slug && slug !== existing.slug) {
      const slugDup = await prisma.category.findUnique({ where: { slug } });
      if (slugDup) {
        return res.status(400).json({ error: { message: `Category slug '${slug}' is already in use.` } });
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        nameAr: name_ar !== undefined ? name_ar : existing.nameAr,
        nameEn: name_en !== undefined ? name_en : existing.nameEn,
        slug: slug !== undefined ? slug : existing.slug,
        sortOrder: sort_order !== undefined ? parseInt(sort_order, 10) : existing.sortOrder,
      },
    });

    res.json({
      id: updated.id,
      name_ar: updated.nameAr,
      name_en: updated.nameEn,
      slug: updated.slug,
      sort_order: updated.sortOrder,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/categories/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { message: "Category not found" } });
    }

    await prisma.category.delete({ where: { id } });
    res.json({ message: "Category deleted successfully." });
  } catch (err) {
    next(err);
  }
});

// ─── Leads CRUD ────────────────────────────────────────────────────
adminRouter.get("/leads", requireAdmin, async (req, res, next) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json({
      leads: leads.map((l) => ({
        id: l.id,
        customer_name: l.customerName,
        customer_phone: l.customerPhone,
        customer_email: l.customerEmail,
        message: l.message,
        product_codes: l.productCodes,
        total_jod: l.totalJod ? Number(l.totalJod) : null,
        status: l.status,
        created_at: l.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/leads/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: { message: "Status is required." } });
    }

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { message: "Lead not found" } });
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { status },
    });

    res.json({
      id: updated.id,
      customer_name: updated.customerName,
      customer_phone: updated.customerPhone,
      customer_email: updated.customerEmail,
      message: updated.message,
      product_codes: updated.productCodes,
      total_jod: updated.totalJod ? Number(updated.totalJod) : null,
      status: updated.status,
      created_at: updated.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/leads/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { message: "Lead not found" } });
    }

    await prisma.lead.delete({ where: { id } });
    res.json({ message: "Lead deleted successfully." });
  } catch (err) {
    next(err);
  }
});
