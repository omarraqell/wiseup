"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { getProduct, getProducts, getProductImageUrl, type Product } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

function ProductContent() {
  const { lang, t } = useLanguage();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const p = await getProduct(code);
        setProduct(p);
        // Fetch related products from the same category
        if (p.category_id) {
          const res = await getProducts({ category_id: p.category_id, limit: 50 });
          setRelated(res.products.filter((x) => x.code !== p.code).slice(0, 6));
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [code]);

  if (loading) {
    return (
      <div className="text-center py-16 text-[#5e3f3b]">
        <span className="material-symbols-outlined text-4xl animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="text-center py-16 text-[#6B6B6B]">
        {t("المنتج غير موجود", "Product not found")}
      </div>
    );
  }

  const name =
    lang === "en" ? (product.name_en || product.name_ar) : product.name_ar;
  const price =
    product.price_jod != null
      ? lang === "en"
        ? `${product.price_jod} JOD`
        : `${product.price_jod} دينار`
      : "";

  return (
    <>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-4 text-[#5e3f3b] text-sm">
         <Link href="/" className="hover:text-brand-red transition-colors">
          {t("الرئيسية", "Home")}
        </Link>
        <span className="material-symbols-outlined text-sm">
          {lang === "en" ? "chevron_right" : "chevron_left"}
        </span>
        <Link href="/catalog" className="hover:text-brand-red transition-colors">
          {t("المتجر", "Shop")}
        </Link>
      </div>

      {/* Product Detail */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Image */}
        <div className="bg-white rounded-lg border border-[#E5E5E5] p-6 flex items-center justify-center">
          {product.image_url ? (
            <img
              src={getProductImageUrl(product.image_url)}
              alt={name}
              width={500}
              height={500}
              className="w-full h-auto object-contain max-h-[400px]"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          ) : (
            <span className="material-symbols-outlined text-gray-300 text-[120px]">
              build
            </span>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="font-[Oswald] text-3xl font-bold text-[#2a1614] mb-2">
            {name}
          </h1>
          <p className="text-[#6B6B6B] mb-4">
            {product.name_en} · {product.name_ar}
          </p>

          <dl className="text-sm space-y-1 mb-6">
            <div>
              <dt className="inline text-[#6B6B6B]">{t("الكود", "Code")}:</dt>{" "}
              <dd className="inline font-mono">{product.code}</dd>
            </div>
            <div>
              <dt className="inline text-[#6B6B6B]">{t("الوحدة", "Unit")}:</dt>{" "}
              <dd className="inline">{product.unit}</dd>
            </div>
            {product.category && (
              <div>
                <dt className="inline text-[#6B6B6B]">
                  {t("الفئة", "Category")}:
                </dt>{" "}
                <dd className="inline">
                  {lang === "en"
                    ? product.category.name_en
                    : product.category.name_ar}
                </dd>
              </div>
            )}
          </dl>

          {price && (
            <div className="text-brand-red font-bold text-3xl mb-6">
              {price}
            </div>
          )}

          <div className="flex gap-3 items-center">
            <input
              type="number"
              min={1}
              defaultValue={1}
              className="w-20 border border-[#E5E5E5] rounded px-3 py-2 text-center"
            />
            <button
              onClick={() =>
                alert(
                  lang === "en"
                    ? "Ordering opens soon — call us to place an order."
                    : "الطلب سيتوفر قريباً — اتصل بنا لإتمام الطلب."
                )
              }
              className="bg-brand-red text-white px-6 py-2 rounded font-semibold hover:bg-brand-dark transition-colors"
            >
              {t("أضف إلى السلة", "Add to Cart")}
            </button>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <div>
          <h3 className="font-[Oswald] text-2xl font-semibold text-[#2a1614] mb-4">
            {t("منتجات ذات صلة", "Related Products")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p, i) => (
              <ProductCard key={p.code} product={p} index={i} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function ProductPage() {
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
        <ProductContent />
      </Suspense>
    </div>
  );
}
