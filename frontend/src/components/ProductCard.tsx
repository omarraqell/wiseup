"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { getProductImageUrl, type Product } from "@/lib/api";

interface ProductCardProps {
  product: Product;
  index?: number;
}

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { lang, t } = useLanguage();
  const name = lang === "en" ? (product.name_en || product.name_ar) : product.name_ar;
  const price =
    product.price_jod != null
      ? lang === "en"
        ? `${product.price_jod} JOD`
        : `${product.price_jod} دينار`
      : "";

  const imageUrl = getProductImageUrl(product.image_url);

  return (
    <Link
      href={`/product?code=${encodeURIComponent(product.code)}`}
      className="card-in block bg-white border border-neutral-200/80 rounded-2xl overflow-hidden group hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:border-neutral-300 transition-all duration-300 relative flex flex-col h-full"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Code Badge in Corner */}
      {product.code && (
        <span className="absolute top-3 left-3 z-10 text-[10px] font-extrabold tracking-wider bg-neutral-900 text-white px-2 py-0.5 rounded-md uppercase font-mono shadow-sm">
          {product.code.replace("WP-", "")}
        </span>
      )}

      {/* Image Container */}
      <div className="aspect-square bg-neutral-50 flex items-center justify-center p-6 overflow-hidden relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            width={300}
            height={300}
            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback = target.parentElement?.querySelector(".fallback-icon");
              if (fallback) (fallback as HTMLElement).style.display = "block";
            }}
          />
        ) : null}
        <span
          className={`material-symbols-outlined text-neutral-300 text-5xl fallback-icon ${imageUrl ? "hidden" : ""}`}
        >
          build
        </span>
      </div>

      {/* Details Container */}
      <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-extrabold text-brand-red uppercase tracking-wider">
            {t("الأدوات المهنية", "PROFESSIONAL TOOLS")}
          </span>
          <h3 className="text-sm font-bold text-[#2a1614] leading-snug line-clamp-2 group-hover:text-brand-red transition-colors duration-200">
            {name}
          </h3>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between">
            {price && (
              <span className="text-base font-extrabold text-[#2a1614]">{price}</span>
            )}
            {product.unit && (
              <span className="text-xs font-semibold text-gray-400 bg-neutral-100 px-2 py-0.5 rounded-md">
                {product.unit}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
