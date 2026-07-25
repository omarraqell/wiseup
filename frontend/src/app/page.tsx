"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { getCategories, getProducts, getProductImageUrl, type Category, type Product } from "@/lib/api";
import ChatWidget from "@/components/ChatWidget";
import ProductCard from "@/components/ProductCard";
import ScrollReveal from "@/components/ScrollReveal";

export default function HomePage() {
  const { lang, dir, t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);

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

  const getMockProducts = (): Product[] => [
    {
      code: "WP-IMPACT-20V",
      name_ar: "مفتاح ربط صدمي لاسلكي 20 فولت عالي العزم",
      name_en: "20V Max Cordless High-Torque Impact Wrench",
      unit: t("قطعة", "Piece"),
      price_jod: 89,
      image_url: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
      category_id: null,
      category: null
    },
    {
      code: "WP-SKT-150",
      name_ar: "مجموعة مفاتيح المقبس واللقم الفاخرة (150 قطعة)",
      name_en: "Elite Chrome Vanadium Socket & Tool Set (150-Piece)",
      unit: t("مجموعة", "Set"),
      price_jod: 120,
      image_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
      category_id: null,
      category: null
    },
    {
      code: "WP-MEASURE-LDM",
      name_ar: "جهاز قياس المسافات بالليزر الاحترافي 80 متر",
      name_en: "Professional 80m Laser Distance Meter & Level",
      unit: t("قطعة", "Piece"),
      price_jod: 35,
      image_url: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=600&q=80",
      category_id: null,
      category: null
    },
    {
      code: "WP-SCW-PREC",
      name_ar: "طقم مفكات براغي معزولة ومغناطيسية (12 قطعة)",
      name_en: "Magnetic Insulated VDE Screwdriver Set (12-Piece)",
      unit: t("مجموعة", "Set"),
      price_jod: 24,
      image_url: "https://images.unsplash.com/photo-1530124560072-aae8d56b0eded?auto=format&fit=crop&w=600&q=80",
      category_id: null,
      category: null
    }
  ];

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));

    getProducts({ limit: 4 })
      .then((res) => {
        if (res && res.products && res.products.length > 0) {
          setFeaturedProducts(res.products);
        } else {
          setFeaturedProducts(getMockProducts());
        }
      })
      .catch(() => {
        setFeaturedProducts(getMockProducts());
      });
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
          <ScrollReveal variant="fade-up" duration={600} delay={100}>
            <div className="bg-[#990a16] text-white text-xs font-semibold px-4 py-1.5 rounded-md uppercase tracking-wider">
              {t("أدوات احترافية", "Professional Tools")}
            </div>
          </ScrollReveal>

          {/* Title */}
          <ScrollReveal variant="fade-up" duration={700} delay={200}>
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
          </ScrollReveal>

          {/* Underline */}
          <ScrollReveal variant="fade-up" duration={500} delay={250}>
            <div className="w-16 h-[3px] bg-brand-red" />
          </ScrollReveal>

          {/* Description */}
          <ScrollReveal variant="fade-up" duration={700} delay={300}>
            <p className="text-gray-300 text-sm md:text-base leading-relaxed max-w-md">
              {t(
                "أدوات صناعية عالية الجودة للمحترفين. متانة لا تضاهى وأداء يثق به الخبراء.",
                "High-quality industrial tools for professionals. Unmatched durability and performance trusted by experts."
              )}
            </p>
          </ScrollReveal>

          {/* Features list */}
          <ScrollReveal variant="fade-up" duration={800} delay={400} className="w-full">
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
          </ScrollReveal>

          {/* Buttons & Social Proof */}
          <ScrollReveal variant="fade-up" duration={800} delay={500}>
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
          </ScrollReveal>
        </div>
      </section>

      {/* Highlights Bar Section */}
      <ScrollReveal variant="fade-up" duration={800} className="max-w-7xl mx-auto px-6 py-8 relative z-20 -mt-16">
        <div className="bg-neutral-950/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8)] py-8 px-6 text-white">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4">
            {highlights.map((item, index) => (
              <div
                key={index}
                className={`flex flex-col items-center text-center px-4 group ${
                  index > 0
                    ? "md:border-l md:border-white/10 rtl:md:border-r rtl:md:border-l-0"
                    : ""
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-brand-red/10 border border-brand-red/20 text-brand-red flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:bg-brand-red group-hover:text-white group-hover:shadow-[0_0_15px_rgba(230,6,22,0.4)]">
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
                    {item.icon}
                  </span>
                </div>
                <h3 className="font-semibold text-base text-white mb-1.5 group-hover:text-brand-red transition-colors duration-300">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed max-w-[220px]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* Featured Products Section */}
      <section className="bg-neutral-50/50 py-16 border-b border-neutral-200/50">
        <div className="max-w-7xl mx-auto px-6">
          <ScrollReveal variant="fade-up" duration={600}>
            <div className="flex flex-col items-center justify-center text-center gap-2 mb-12">
              <span className="text-xs font-bold text-brand-red uppercase tracking-widest bg-brand-red/5 px-3 py-1 rounded-md border border-brand-red/10">
                {t("المنتجات المميزة", "ELITE SELECTION")}
              </span>
              <h2 className="font-[Oswald] text-3xl md:text-4xl font-bold text-[#2a1614] tracking-tight">
                {t("الأدوات الأكثر طلباً", "Featured Tools & Equipment")}
              </h2>
              <div className="w-16 h-1 bg-brand-red rounded-full mt-2" />
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducts.map((prod, index) => (
              <ScrollReveal key={prod.code} variant="fade-up" duration={600} delay={index * 100}>
                <ProductCard product={prod} index={index} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Industrial Excellence Promo Banner */}
      <section className="w-full bg-[#0a0505] text-white py-16 relative overflow-hidden">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(153,10,22,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(153,10,22,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
          <ScrollReveal variant="fade-right" duration={700} className="lg:col-span-7 flex flex-col gap-6 items-start rtl:text-right text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-red bg-brand-red/10 border border-brand-red/20 px-3.5 py-1 rounded">
              {t("عمر افتراضي غير محدود", "UNLIMITED LIFETIME WARRANTY")}
            </span>
            <h2 className="font-[Oswald] text-3xl md:text-5xl font-bold leading-tight">
              {lang === "en" ? (
                <>ENGINEERED FOR <span className="text-brand-red">EXTREME</span> PERFORMANCE</>
              ) : (
                <>صُممت للأداء <span className="text-brand-red">الأقصى</span> والظروف الصعبة</>
              )}
            </h2>
            <p className="text-gray-400 text-sm md:text-base leading-relaxed max-w-xl">
              {t(
                "جميع أدوات WiseUp مصنوعة من الفولاذ عالي الجودة المقاوم للصدأ والتآكل، ومصممة هندسياً لتقليل إجهاد اليد أثناء العمل الشاق والمستمر.",
                "All WiseUp tools are crafted from high-density, rust-resistant steel alloy, and ergonomically balanced to minimize hand strain during prolonged professional operations."
              )}
            </p>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-2">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-red text-2xl">construction</span>
                <span className="text-sm font-semibold text-gray-200">{t("فولاذ الكروم المقوى", "Hardened Cr-V Steel")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-red text-2xl">shield</span>
                <span className="text-sm font-semibold text-gray-200">{t("حماية ضد التآكل", "Anti-Corrosion Shield")}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <Link href="/catalog" className="bg-brand-red hover:bg-[#b30c1a] active:bg-[#800812] text-white px-6 py-3 rounded-lg font-bold text-sm transition-all duration-300 shadow-lg hover:shadow-[0_4px_20px_rgba(230,6,22,0.3)]">
                {t("عرض الكتالوج الكامل", "View Full Catalog")}
              </Link>
              <Link href="/signup" className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-lg font-bold text-sm transition-all duration-300">
                {t("حساب الشركات والموزعين", "Corporate & Dealer Account")}
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal variant="zoom-in" duration={800} delay={200} className="lg:col-span-5 relative flex justify-center items-center">
            <div className="relative w-full aspect-square max-w-[400px] rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 flex items-center justify-center group shadow-2xl">
              <div className="absolute inset-0 bg-brand-red/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img 
                src="https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80" 
                alt="Heavy Duty Tools" 
                className="w-[85%] h-[85%] object-contain transform group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-4 right-4 bg-brand-red/90 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                {t("قوة لا تضاهى", "Maximum Torque")}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Category Grid Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <ScrollReveal variant="fade-up" duration={600}>
          <div className="flex flex-col items-center justify-center text-center gap-2 mb-12">
            <span className="text-xs font-bold text-brand-red uppercase tracking-widest bg-brand-red/5 px-3 py-1 rounded-md border border-brand-red/10">
              {t("فئات المنتجات", "PRODUCT RANGE")}
            </span>
            <h2 className="font-[Oswald] text-3xl md:text-4xl font-bold text-[#2a1614] tracking-tight">
              {t("تصفح الفئات الرئيسية", "Browse Core Categories")}
            </h2>
            <div className="w-16 h-1 bg-brand-red rounded-full mt-2" />
          </div>
        </ScrollReveal>

        {/* Category Cards — show first 5 */}
        <ScrollReveal variant="fade-up" duration={700} delay={150}>
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
                  className="group relative block"
                >
                  <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-2 hover:border-brand-red/40 transition-all duration-500">
                    {/* Image Area */}
                    <div className="w-full aspect-square bg-[#fafafa] flex items-center justify-center p-6 relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <img
                        src={img}
                        alt={lang === "en" ? cat.name_en : cat.name_ar}
                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    {/* Label Area */}
                    <div className="relative px-4 py-4 text-center border-t border-neutral-100 bg-white">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-16 h-[2px] bg-brand-red transition-all duration-300" />
                      <span className="text-sm font-bold text-[#2a1614] group-hover:text-brand-red transition-colors duration-300 block truncate">
                        {lang === "en" ? cat.name_en : cat.name_ar}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollReveal>

        {/* View All Categories Button */}
        <ScrollReveal variant="fade-up" duration={500} delay={300} className="flex justify-center mt-10">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 border border-brand-red text-brand-red hover:bg-brand-red hover:text-white px-6 py-3 rounded-lg text-sm font-bold transition-all duration-300 shadow-sm hover:shadow-[0_4px_20px_rgba(230,6,22,0.15)]"
          >
            <span>{t("عرض جميع الفئات", "View All Categories")}</span>
            <span className="material-symbols-outlined text-lg rtl:rotate-180">arrow_forward</span>
          </Link>
        </ScrollReveal>
      </section>

      {/* Support & Help (FAQ) Accordion Section */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <ScrollReveal variant="fade-up" duration={600}>
          <div className="flex flex-col items-center justify-center text-center gap-2 mb-12">
            <span className="text-xs font-bold text-brand-red uppercase tracking-widest bg-brand-red/5 px-3 py-1 rounded-md border border-brand-red/10">
              {t("الأسئلة الشائعة", "CUSTOMER HELP")}
            </span>
            <h2 className="font-[Oswald] text-3xl font-bold text-[#2a1614] tracking-tight">
              {t("الأسئلة الشائعة والدعم", "Frequently Asked Questions")}
            </h2>
            <div className="w-16 h-1 bg-brand-red rounded-full mt-2" />
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fade-up" duration={700} delay={200}>
          <div className="flex flex-col gap-4">
            {/* FAQ Item 1 */}
            <details className="group border border-neutral-200/80 rounded-2xl bg-white p-5 cursor-pointer transition-all duration-300 open:shadow-lg open:border-brand-red/30">
              <summary className="list-none flex justify-between items-center font-bold text-[#2a1614] text-sm md:text-base group-hover:text-brand-red transition-colors duration-300">
                <span>{t("ما هي فترة الضمان لمنتجات WiseUp؟", "What is the warranty period for WiseUp products?")}</span>
                <span className="material-symbols-outlined text-xl transition-transform duration-300 group-open:rotate-180 text-gray-500 group-hover:text-brand-red">keyboard_arrow_down</span>
              </summary>
              <div className="mt-3 text-xs md:text-sm text-gray-500 leading-relaxed border-t border-neutral-100 pt-3">
                {t(
                  "نحن نقدم ضمانًا محدودًا مدى الحياة على عيوب التصنيع لجميع الأدوات اليدوية الاحترافية. للملحقات والأجهزة الكهربائية، يتراوح الضمان بين 12 إلى 24 شهرًا.",
                  "We offer a limited lifetime warranty against manufacturing defects on all professional hand tools. Accessories and power tools come with a standard 12 to 24-month warranty."
                )}
              </div>
            </details>

            {/* FAQ Item 2 */}
            <details className="group border border-neutral-200/80 rounded-2xl bg-white p-5 cursor-pointer transition-all duration-300 open:shadow-lg open:border-brand-red/30">
              <summary className="list-none flex justify-between items-center font-bold text-[#2a1614] text-sm md:text-base group-hover:text-brand-red transition-colors duration-300">
                <span>{t("كم يستغرق شحن وتوصيل الطلبات؟", "How long does shipping and delivery take?")}</span>
                <span className="material-symbols-outlined text-xl transition-transform duration-300 group-open:rotate-180 text-gray-500 group-hover:text-brand-red">keyboard_arrow_down</span>
              </summary>
              <div className="mt-3 text-xs md:text-sm text-gray-500 leading-relaxed border-t border-neutral-100 pt-3">
                {t(
                  "يتم معالجة وتوصيل الطلبات داخل الأردن في غضون 24 إلى 48 ساعة عمل. الشحن الدولي يستغرق من 3 إلى 7 أيام عمل حسب الوجهة.",
                  "Orders within Jordan are processed and delivered within 24 to 48 business hours. International shipping takes 3 to 7 business days depending on the destination country."
                )}
              </div>
            </details>

            {/* FAQ Item 3 */}
            <details className="group border border-neutral-200/80 rounded-2xl bg-white p-5 cursor-pointer transition-all duration-300 open:shadow-lg open:border-brand-red/30">
              <summary className="list-none flex justify-between items-center font-bold text-[#2a1614] text-sm md:text-base group-hover:text-brand-red transition-colors duration-300">
                <span>{t("هل تقدمون أسعار خاصة للشركات والمقاولين؟", "Do you offer corporate or bulk pricing?")}</span>
                <span className="material-symbols-outlined text-xl transition-transform duration-300 group-open:rotate-180 text-gray-500 group-hover:text-brand-red">keyboard_arrow_down</span>
              </summary>
              <div className="mt-3 text-xs md:text-sm text-gray-500 leading-relaxed border-t border-neutral-100 pt-3">
                {t(
                  "نعم بالتأكيد. من خلال التسجيل بحساب شركات (Business Account)، ستحصل على تسعير خاص للمشاريع والطلبات بالجملة، بالإضافة إلى دعم مخصص وشروط دفع مرنة.",
                  "Yes, absolutely. By signing up for a Business Account, you gain access to wholesale and project pricing, dedicated support, and flexible credit payment terms."
                )}
              </div>
            </details>
          </div>
        </ScrollReveal>
      </section>

      {/* AI Chat Widget */}
      <ChatWidget />
    </>
  );
}
