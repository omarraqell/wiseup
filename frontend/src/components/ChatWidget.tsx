"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { askChat, resetChat } from "@/lib/api";
import type { Product } from "@/lib/api";
import ProductCard from "./ProductCard";

export default function ChatWidget() {
  const { lang, t } = useLanguage();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [kValue, setKValue] = useState(9);
  const [showEmpty, setShowEmpty] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Session ID
  const sessionIdRef = useRef<string>("");
  useEffect(() => {
    let sid = localStorage.getItem("wiseup_sid");
    if (!sid) {
      sid = crypto.randomUUID?.() || `sid-${Date.now()}${Math.random()}`;
      localStorage.setItem("wiseup_sid", sid);
    }
    sessionIdRef.current = sid;
  }, []);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || loading) return;

    setLoading(true);
    setShowEmpty(false);
    try {
      const data = await askChat({
        query: q,
        k: kValue,
        generate: aiEnabled,
        session_id: sessionIdRef.current,
      });

      setAnswer(data.answer || null);
      setProducts(data.products || []);

      if (!data.answer && (!data.products || data.products.length === 0)) {
        setShowEmpty(true);
      }
    } catch {
      setAnswer(null);
      setProducts([]);
      setShowEmpty(true);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      await resetChat(sessionIdRef.current);
    } catch {
      // ignore
    }
    const newSid = crypto.randomUUID?.() || `sid-${Date.now()}${Math.random()}`;
    localStorage.setItem("wiseup_sid", newSid);
    sessionIdRef.current = newSid;
    setAnswer(null);
    setProducts([]);
    setQuery("");
    setShowEmpty(true);
  };

  // Strip markdown formatting for display
  const stripMarkdown = (s: string) =>
    s
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/(^|\s)\*(\S.*?)\*/g, "$1$2")
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "");

  return (
    <section className="max-w-7xl mx-auto px-6 py-8">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-8 border-b border-[#E5E5E5] pb-4">
        <h2 className="font-[Oswald] text-[32px] font-semibold text-[#2a1614]">
          {t("اسأل مساعد WISEUP", "Ask WISEUP Assistant")}
        </h2>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-[#5e3f3b] hover:text-brand-red transition-colors"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          {t("محادثة جديدة", "New Chat")}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          {/* AI Toggle */}
          <div className="p-4 bg-[#fff8f7] rounded-lg border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-sm">
                {t("إجابة ذكية (WISEUP)", "Smart Answer (WISEUP)")}
              </label>
              <button
                onClick={() => setAiEnabled(!aiEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  aiEnabled ? "bg-brand-red" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    aiEnabled ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-[#5e3f3b]">
              {t("بحث دلالي مفعّل", "Semantic search enabled")}
            </p>
          </div>

          {/* K Slider */}
          <div className="p-4 bg-[#fff8f7] rounded-lg border border-[#E5E5E5] shadow-sm">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span>{t("عدد النتائج", "Results count")}</span>
              <span className="text-brand-red">{kValue}</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={kValue}
              onChange={(e) => setKValue(parseInt(e.target.value))}
              className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-brand-red"
            />
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Search Bar */}
          <div className="w-full relative shadow-sm border border-[#E5E5E5] rounded-lg bg-[#fff8f7] overflow-hidden flex focus-within:ring-2 focus-within:ring-brand-red focus-within:border-brand-red transition-all">
            <div className={`flex items-center justify-center text-brand-red ${lang === "ar" ? "pr-4" : "pl-4"}`}>
              <span className="material-symbols-outlined text-2xl">search</span>
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full py-4 px-4 text-lg bg-transparent border-none focus:ring-0 focus:outline-none placeholder-[#5e3f3b]"
              placeholder={t(
                "اسأل عن المنتجات... مثلاً: زرادية كهرباء، مفك، متر قياس",
                "Ask about products... e.g. pliers, screwdriver, tape measure"
              )}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-brand-red text-white px-8 font-bold uppercase tracking-wide hover:bg-brand-dark transition-colors flex items-center gap-2 disabled:opacity-60 shrink-0"
            >
              <span>{loading ? (aiEnabled ? t("جاري...", "Asking…") : t("بحث...", "Searching…")) : t("بحث", "Search")}</span>
              <span className={`material-symbols-outlined text-sm ${lang === "ar" ? "rotate-180" : ""}`}>
                {loading ? "hourglass_top" : "arrow_forward"}
              </span>
            </button>
          </div>

          {/* AI Answer Panel */}
          {answer && (
            <div className={`bg-[#fff0ee] border border-[#E5E5E5] ${lang === "ar" ? "border-r-4 border-r-brand-red" : "border-l-4 border-l-brand-red"} rounded-lg p-6 shadow-sm flex gap-4 items-start relative overflow-hidden group`}>
              <div className={`absolute ${lang === "ar" ? "-left-8" : "-right-8"} -top-8 text-[#ffdad6] opacity-50 pointer-events-none transform rotate-12 group-hover:rotate-0 transition-transform duration-700`}>
                <span className="material-symbols-outlined" style={{ fontSize: "140px" }}>
                  smart_toy
                </span>
              </div>
              <div className="flex-shrink-0 bg-[#fff8f7] p-3 rounded-full border border-[#E5E5E5] shadow-sm z-10">
                <span className="material-symbols-outlined text-brand-red text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  smart_toy
                </span>
              </div>
              <div className="flex-1 z-10 pt-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#5e3f3b] mb-2 flex items-center gap-2">
                  {t("مساعد الكتالوج بالذكاء الاصطناعي", "AI Catalog Assistant")}{" "}
                  <span className="bg-brand-red/10 text-brand-red text-xs px-2 py-0.5 rounded-sm">
                    WISEUP
                  </span>
                </h3>
                <p className="text-lg leading-relaxed text-[#2a1614] font-medium">
                  {stripMarkdown(answer)}
                </p>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {products.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-[Oswald] text-2xl font-semibold text-[#2a1614]">
                  {t("منتجات مطابقة", "Matching Products")}
                </h3>
                <div className="text-sm text-[#5e3f3b]">
                  {products.length} {t("نتيجة", "results")}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p, i) => (
                  <ProductCard key={p.code} product={p} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {showEmpty && !answer && products.length === 0 && (
            <div className="text-[#5e3f3b] text-center py-16">
              {t(
                "اكتب سؤالاً أعلاه للبحث في كتالوج WISEUP.",
                "Type a question above to search the WISEUP catalog."
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
