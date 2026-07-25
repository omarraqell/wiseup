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
    is_active: p.isActive,
    category_id: p.categoryId,
    category: p.category
      ? { name_ar: p.category.nameAr, name_en: p.category.nameEn, slug: p.category.slug }
      : null,
    ...(includePrice ? { price_jod: Number(p.priceJod) } : {}),
  };
}
