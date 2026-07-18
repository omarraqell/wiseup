"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { getCategories, type Category } from "@/lib/api";
import ChatWidget from "@/components/ChatWidget";

export default function HomePage() {
  const { lang, dir, t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);

  const highlights = [
    {
      icon: "verified",
      title: t("جودة مضمونة", "Guaranteed Quality"),
      desc: t(
        "منتجات أصلية 100% مع ضمان على الجودة",
        "100% original products with quality guarantee"
      ),
    },
    {
      icon: "local_shipping",
      title: t("شحن سريع", "Fast Shipping"),
      desc: t(
        "توصيل سريع وآمن إلى باب منزلك",
        "Fast and safe delivery to your doorstep"
      ),
    },
    {
      icon: "assignment_return",
      title: t("إرجاع سهل", "Easy Returns"),
      desc: t(
        "إرجاع واستبدال خلال 14 يوم بدون تعقيد",
        "Hassle-free return & exchange within 14 days"
      ),
    },
    {
      icon: "support_agent",
      title: t("دعم متخصص", "Dedicated Support"),
      desc: t(
        "فريق دعم جاهز للإجابة على استفساراتك",
        "Support team ready to answer your questions"
      ),
    },
  ];

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="relative w-full h-[100dvh] overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/hero-bg.png')",
          }}
        />
        
        {/* Dark Overlay Gradient (fades from dark on the start side to transparent on the end side) */}
        <div
          className={`absolute inset-0 ${
            dir === "rtl"
              ? "bg-gradient-to-l from-black via-black/85 to-transparent"
              : "bg-gradient-to-r from-black via-black/85 to-transparent"
          }`}
        />

        {/* Content Wrapper (aligns to start side based on direction) */}
        <div
          className={`absolute ${
            dir === "rtl" ? "right-0 px-8 md:px-16" : "left-0 px-8 md:px-16"
          } top-0 bottom-0 w-full md:w-[60%] flex flex-col justify-center items-start text-left rtl:text-right z-10 gap-6`}
          dir={dir}
        >
          {/* Badge */}
          <div className="bg-[#990a16] text-white text-xs font-semibold px-4 py-1.5 rounded-md uppercase tracking-wider">
            {t("أدوات احترافية", "Professional Tools")}
          </div>

          {/* Title */}
          <h1 className="font-[Oswald] text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            {lang === "en" ? (
              <>
                <span className="text-white">Power in</span>{" "}
                <span className="text-brand-red">Your Hands</span>
              </>
            ) : (
              <>
                <span className="text-brand-red">القوة</span>{" "}
                <span className="text-white">في يديك</span>
              </>
            )}
          </h1>

          {/* Underline */}
          <div className="w-16 h-[3px] bg-brand-red" />

          {/* Description */}
          <p className="text-gray-300 text-sm md:text-base leading-relaxed max-w-md">
            {t(
              "أدوات صناعية عالية الجودة للمحترفين. متانة لا تضاهى وأداء يثق به الخبراء.",
              "High-quality industrial tools for professionals. Unmatched durability and performance trusted by experts."
            )}
          </p>

          {/* Features list */}
          <div className="grid grid-cols-3 gap-4 w-full mt-2 max-w-lg">
            {/* Feature 1 */}
            <div className="flex flex-col items-start text-left rtl:text-right gap-1">
              <div className="w-10 h-10 rounded-full border border-brand-red/30 flex items-center justify-center text-brand-red bg-brand-red/5">
                <span className="material-symbols-outlined text-lg">verified_user</span>
              </div>
              <span className="text-white text-xs font-bold mt-1">
                {t("جودة عالية", "High Quality")}
              </span>
              <span className="text-gray-400 text-[10px] leading-tight">
                {t("مواد متينة ومضمونة", "Durable & Guaranteed")}
              </span>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col items-start text-left rtl:text-right gap-1">
              <div className="w-10 h-10 rounded-full border border-brand-red/30 flex items-center justify-center text-brand-red bg-brand-red/5">
                <span className="material-symbols-outlined text-lg">settings</span>
              </div>
              <span className="text-white text-xs font-bold mt-1">
                {t("أداء موثوق", "Relied Performance")}
              </span>
              <span className="text-gray-400 text-[10px] leading-tight">
                {t("مصممة للتحمل الشاق", "Heavy Duty Design")}
              </span>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col items-start text-left rtl:text-right gap-1">
              <div className="w-10 h-10 rounded-full border border-brand-red/30 flex items-center justify-center text-brand-red bg-brand-red/5">
                <span className="material-symbols-outlined text-lg">workspace_premium</span>
              </div>
              <span className="text-white text-xs font-bold mt-1">
                {t("موجه للمحترفين", "For Professionals")}
              </span>
              <span className="text-gray-400 text-[10px] leading-tight">
                {t("اختيار الخبراء والمهندسين", "Choice of Experts")}
              </span>
            </div>
          </div>

          {/* Buttons & Social Proof */}
          <div className="flex items-center gap-4 mt-2">
            <Link
              href="/catalog"
              dir="ltr"
              className="bg-brand-red hover:bg-brand-dark text-white px-8 py-3.5 rounded-md font-semibold transition-colors flex items-center gap-2"
            >
              <span className="font-bold">←</span>
              <span>{t("تسوق الآن", "Shop Now")}</span>
            </Link>

            {/* Social Proof */}
            <div className="bg-[#10151f]/60 backdrop-blur-sm border border-white/5 rounded-xl px-4 py-2 flex items-center gap-3">
              <div className={`flex -space-x-2 ${dir === "rtl" ? "space-x-reverse" : ""}`}>
                <img
                  className="w-7 h-7 rounded-full border border-gray-800 object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                  alt="Customer 1"
                />
                <img
                  className="w-7 h-7 rounded-full border border-gray-800 object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
                  alt="Customer 2"
                />
                <img
                  className="w-7 h-7 rounded-full border border-gray-800 object-cover"
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80"
                  alt="Customer 3"
                />
                <img
                  className="w-7 h-7 rounded-full border border-gray-800 object-cover"
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
                  alt="Customer 4"
                />
              </div>
              <div className={`flex flex-col text-[10px] leading-tight ${dir === "rtl" ? "text-right" : "text-left"}`}>
                <span className="text-white font-bold text-sm">+10,000</span>
                <span className="text-gray-400">{t("عميل راضي", "Happy Customers")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Bar Section */}
      <section className="max-w-7xl mx-auto px-6 py-8 relative z-20">
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm py-8 px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-0">
            {highlights.map((item, index) => (
              <div
                key={index}
                className={`flex flex-col items-center text-center px-4 ${
                  index > 0
                    ? "border-t border-[#E5E5E5] pt-6 md:pt-0 md:border-t-0 md:border-l rtl:md:border-r rtl:md:border-l-0"
                    : ""
                }`}
              >
                <div className="text-brand-red mb-3">
                  <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
                    {item.icon}
                  </span>
                </div>
                <h3 className="font-semibold text-base text-[#2a1614] mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-[#6B6B6B] leading-relaxed max-w-[200px]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Chat Widget */}
      <ChatWidget />

      {/* Category Grid */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        {/* Section Title with red accent lines */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="w-10 h-[2px] bg-brand-red" />
          <h2 className="font-[Oswald] text-[32px] font-semibold text-[#2a1614]">
            {t("تصفح الفئات", "Browse Categories")}
          </h2>
          <div className="w-10 h-[2px] bg-brand-red" />
        </div>

        {/* Category Cards — show first 5 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {categories.slice(0, 5).map((cat) => {
            const imageMap: Record<string, string> = {
              "pliers-series": "/categories/pliers-series.png",
              "wrench-series": "/categories/wrench-series.png",
              "measurement-series": "/categories/measurement-series.png",
              "hammer-series": "/categories/hammer-series.png",
              "shearing-series": "/categories/shearing-series.png",
              "screwdriver-series": "/categories/hand-tools.png",
              "saw-series": "/categories/hand-tools.png",
            };
            const img = imageMap[cat.slug] || "/categories/hand-tools.png";

            return (
              <Link
                key={cat.id}
                href={`/category?id=${cat.id}`}
                className="group"
              >
                <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-2 transition-all duration-300">
                  {/* Image Area */}
                  <div className="w-full aspect-square bg-[#fafafa] flex items-center justify-center p-6">
                    <img
                      src={img}
                      alt={lang === "en" ? cat.name_en : cat.name_ar}
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  {/* Label Area */}
                  <div className="relative px-4 py-3 text-center border-t border-[#f0f0f0]">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-12 h-[2px] bg-brand-red transition-all duration-300" />
                    <span className="text-sm font-semibold text-[#2a1614] group-hover:text-brand-red transition-colors duration-300">
                      {lang === "en" ? cat.name_en : cat.name_ar}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* View All Categories Button */}
        <div className="flex justify-center mt-10">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 border border-brand-red text-brand-red hover:bg-brand-red hover:text-white px-6 py-2.5 rounded-md text-sm font-semibold transition-colors duration-300"
          >
            <span>{t("عرض جميع الفئات", "View All Categories")}</span>
            <span className="material-symbols-outlined text-lg rtl:rotate-180">arrow_forward</span>
          </Link>
        </div>
      </section>
    </>
  );
}
