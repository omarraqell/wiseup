"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { getCategories, getProducts, type Category, type Product } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

function CategoryContent() {
  const { lang, t } = useLanguage();
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const cats = await getCategories();
        const found = cats.find((c) => c.id === id);
        if (!found) {
          setNotFound(true);
          return;
        }
        setCategory(found);
        const prodRes = await getProducts({ category_id: id, limit: 100 });
        setProducts(prodRes.products);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-16 text-[#5e3f3b]">
        <span className="material-symbols-outlined text-4xl animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  if (notFound || !category) {
    return (
      <div className="text-center py-16 text-[#6B6B6B]">
        {t("الفئة غير موجودة", "Category not found")}
      </div>
    );
  }

  return (
    <>
      {/* Category Header */}
      <div className="mb-8 border-b border-[#E5E5E5] pb-2 flex justify-between items-end">
        <h1 className="font-[Oswald] text-[48px] font-bold text-[#2a1614]">
          {lang === "en" ? category.name_en : category.name_ar}
        </h1>
        <span className="text-base text-[#5e3f3b]">
          {products.length} {t("منتج", "products")}
        </span>
      </div>

      {/* Product Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((p, i) => (
            <ProductCard key={p.code} product={p} index={i} />
          ))}
        </div>
      ) : (
        <p className="text-center text-[#6B6B6B] py-12">
          {t("لا توجد منتجات في هذه الفئة", "No products in this category")}
        </p>
      )}
    </>
  );
}

export default function CategoryPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <Suspense
        fallback={
          <div className="text-center py-16 text-[#5e3f3b]">
            <span className="material-symbols-outlined text-4xl animate-spin">
              progress_activity
            </span>
          </div>
        }
      >
        <CategoryContent />
      </Suspense>
    </div>
  );
}
