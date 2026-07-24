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
