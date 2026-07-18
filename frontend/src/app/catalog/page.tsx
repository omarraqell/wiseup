"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { getCategories, getProducts, type Category, type Product } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default function CatalogPage() {
  const { lang, t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [cats, prodRes] = await Promise.all([
          getCategories(),
          getProducts({ limit: 100 }),
        ]);
        setCategories(cats);
        setAllProducts(prodRes.products);
        setFiltered(prodRes.products);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const cid = selectedCategory ? Number(selectedCategory) : null;
    const q = searchQuery.trim().toLowerCase();

    setFiltered(
      allProducts.filter((p) => {
        const matchCategory = cid === null || p.category_id === cid;
        const matchSearch =
          !q ||
          `${p.name_ar} ${p.name_en || ""} ${p.code}`.toLowerCase().includes(q);
        return matchCategory && matchSearch;
      })
    );
  }, [selectedCategory, searchQuery, allProducts]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-4">
      {/* Sidebar */}
      <aside className="w-full md:w-1/4 shrink-0 flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <label className="sr-only" htmlFor="catalog-search">
            {t("ابحث عن منتج", "Search for a product")}
          </label>
          <input
            id="catalog-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-4 pr-10 border border-[#E5E5E5] rounded-sm focus:border-brand-red focus:ring-1 focus:ring-brand-red text-base bg-white"
            placeholder={t("ابحث...", "Search...")}
          />
          <span className="material-symbols-outlined absolute right-3 top-3 text-[#5f5e5e]">
            search
          </span>
        </div>

        {/* Category Filter */}
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
          <h3 className="font-[Oswald] text-xl font-medium mb-2 text-[#2a1614]">
            {t("الفئات", "Categories")}
          </h3>
          <label className="sr-only" htmlFor="category-filter">
            {t("تصفية حسب الفئة", "Filter by category")}
          </label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full h-12 border border-[#E5E5E5] rounded-sm focus:border-brand-red focus:ring-1 focus:ring-brand-red text-sm text-[#5e3f3b] bg-white"
          >
            <option value="">{t("الكل", "All")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "en" ? c.name_en : c.name_ar} ({c.count})
              </option>
            ))}
          </select>
        </div>
      </aside>

      {/* Product Grid */}
      <section className="w-full md:w-3/4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-[Oswald] text-[32px] font-semibold text-[#2a1614]">
            {t("جميع المنتجات", "All Products")}
          </h1>
          <span className="text-sm text-[#5e3f3b]">
            {filtered.length} {t("منتج", "products")}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-[#5e3f3b]">
            <span className="material-symbols-outlined text-4xl animate-spin">
              progress_activity
            </span>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p, i) => (
              <ProductCard key={p.code} product={p} index={i} />
            ))}
          </div>
        ) : (
          <p className="col-span-full text-center text-[#6B6B6B] py-12">
            {t("لا توجد نتائج", "No results")}
          </p>
        )}
      </section>
    </div>
  );
}
