"use client";

import Link from "next/link";
import Image from "next/image";
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
      className="card-in block bg-white border border-[#E5E5E5] rounded-lg overflow-hidden group hover:shadow-lg transition-shadow"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Image */}
      <div className="aspect-square bg-[#F5F5F5] flex items-center justify-center p-4 overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={300}
            height={300}
            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback = target.parentElement?.querySelector(".fallback-icon");
              if (fallback) (fallback as HTMLElement).style.display = "block";
            }}
          />
        ) : null}
        <span
          className={`material-symbols-outlined text-gray-400 text-6xl fallback-icon ${imageUrl ? "hidden" : ""}`}
        >
          build
        </span>
      </div>

      {/* Details */}
      <div className="p-3 flex flex-col gap-2">
        <h3 className="text-sm font-medium leading-snug line-clamp-2">{name}</h3>
        <div className="flex items-center justify-between">
          {price && (
            <span className="text-base font-bold text-brand-red">{price}</span>
          )}
          {product.unit && (
            <span className="text-xs text-[#6B6B6B]">{product.unit}</span>
          )}
        </div>
        {product.code && (
          <span className="text-xs text-[#6B6B6B] font-mono" dir="ltr">
            {t("كود", "Code")}: {product.code}
          </span>
        )}
      </div>
    </Link>
  );
}
