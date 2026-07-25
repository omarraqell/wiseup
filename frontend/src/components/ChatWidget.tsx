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
    <section className="max-w-7xl mx-auto px-6 py-16">
      {/* Section Header */}
      <div className="flex flex-col items-center justify-center text-center gap-2 mb-10">
        <span className="text-xs font-bold text-brand-red uppercase tracking-widest bg-brand-red/5 px-3 py-1 rounded-md border border-brand-red/10">
          {t("المساعد الذكي بالذكاء الاصطناعي", "AI POWERED SEARCH")}
        </span>
        <h2 className="font-[Oswald] text-3xl md:text-4xl font-bold text-[#2a1614] tracking-tight">
          {t("اسأل مساعد WISEUP الذكي", "Ask WISEUP Smart Assistant")}
        </h2>
        <div className="w-16 h-1 bg-brand-red rounded-full mt-2" />
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
            {t("مساعد متاح الآن", "Assistant Online")}
          </span>
        </div>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-neutral-600 hover:text-brand-red border border-neutral-300/80 hover:border-brand-red/40 bg-white hover:bg-brand-red/5 px-4 py-2 rounded-xl transition-all duration-300"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          {t("محادثة جديدة", "New Chat")}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          {/* AI Toggle */}
          <div className="p-5 bg-white rounded-2xl border border-neutral-200/85 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-sm text-[#2a1614]">
                {t("إجابة ذكية (WISEUP)", "Smart Answer (WISEUP)")}
              </label>
              <button
                onClick={() => setAiEnabled(!aiEnabled)}
                className={`relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                  aiEnabled ? "bg-brand-red" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    aiEnabled ? "translate-x-5 rtl:-translate-x-5" : "translate-x-1 rtl:-translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {t("بحث دلالي مفعّل بالكامل", "AI semantic searching activated")}
            </p>
          </div>

          {/* K Slider */}
          <div className="p-5 bg-white rounded-2xl border border-neutral-200/85 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex justify-between text-sm font-bold mb-2 text-[#2a1614]">
              <span>{t("عدد النتائج", "Results count")}</span>
              <span className="text-brand-red font-mono">{kValue}</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={kValue}
              onChange={(e) => setKValue(parseInt(e.target.value))}
              className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-brand-red"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 font-mono">
              <span>1</span>
              <span>30</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          {/* Search Bar */}
          <div className="w-full relative shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-neutral-200/85 focus-within:border-brand-red/40 focus-within:shadow-[0_8px_30px_rgba(230,6,22,0.04)] rounded-2xl bg-white overflow-hidden flex transition-all duration-300 p-1.5">
            <div className="flex items-center justify-center text-gray-400 pl-4 pr-2">
              <span className="material-symbols-outlined text-2xl">search</span>
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full py-3.5 px-3 text-base text-neutral-800 bg-transparent border-none focus:ring-0 focus:outline-none placeholder-gray-400 font-medium"
              placeholder={t(
                "اسأل عن المنتجات... مثلاً: زرادية كهرباء، مفك، متر قياس",
                "Ask about products... e.g. pliers, screwdriver, tape measure"
              )}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-brand-red text-white px-7 py-3 rounded-xl font-bold uppercase tracking-wide hover:bg-[#b30c1a] active:scale-[0.98] transition-all duration-300 flex items-center gap-2 disabled:opacity-60 shrink-0 shadow-sm"
            >
              <span>{loading ? (aiEnabled ? t("جاري...", "Asking…") : t("بحث...", "Searching…")) : t("بحث", "Search")}</span>
              <span className="material-symbols-outlined text-base">
                {loading ? "hourglass_top" : "arrow_forward"}
              </span>
            </button>
          </div>

          {/* AI Answer Panel */}
          {answer && (
            <div className={`bg-brand-red/[0.015] border border-brand-red/10 rounded-2xl p-6 shadow-sm flex gap-5 items-start relative overflow-hidden group`}>
              <div className="absolute right-0 top-0 w-24 h-24 bg-brand-red/5 rounded-bl-full pointer-events-none" />
              <div className="flex-shrink-0 bg-brand-red/10 p-3 rounded-xl border border-brand-red/20 shadow-sm z-10 text-brand-red">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  smart_toy
                </span>
              </div>
              <div className="flex-1 z-10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-red mb-2 flex items-center gap-2">
                  {t("إجابة مساعد WISEUP الذكي", "AI ASSISTANT ANSWER")}
                </h3>
                <p className="text-base leading-relaxed text-[#2a1614] font-medium whitespace-pre-line">
                  {stripMarkdown(answer)}
                </p>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {products.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-[Oswald] text-2xl font-bold text-[#2a1614] tracking-tight">
                  {t("منتجات مطابقة", "Matching Products")}
                </h3>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {products.length} {t("نتيجة", "results")}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((p, i) => (
                  <ProductCard key={p.code} product={p} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State & Suggestions */}
          {showEmpty && !answer && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4 border border-neutral-200/50">
                <span className="material-symbols-outlined text-3xl">chat_bubble</span>
              </div>
              <p className="text-sm font-semibold text-neutral-500 mb-6 max-w-sm">
                {t(
                  "اكتب سؤالاً أعلاه للبحث في كتالوج WISEUP بالذكاء الاصطناعي.",
                  "Ask a question above to explore the WISEUP catalog with AI search."
                )}
              </p>
              
              {/* Suggestion Chips */}
              <div className="flex flex-wrap justify-center gap-2.5 max-w-lg">
                {[
                  { ar: "زرادية عازلة للكهرباء", en: "VDE insulated pliers" },
                  { ar: "أفضل طقم مفاتيح ربط", en: "Best wrench set" },
                  { ar: "متر قياس ليزر للمسافات البعيدة", en: "Laser distance meter" },
                  { ar: "شاكوش مخلب بمقبض مريح", en: "Claw hammer with ergonomic handle" }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(lang === "en" ? item.en : item.ar);
                      setTimeout(() => {
                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }, 50);
                    }}
                    className="text-xs font-bold text-neutral-600 hover:text-brand-red bg-neutral-50 hover:bg-brand-red/5 border border-neutral-200 hover:border-brand-red/20 px-3.5 py-2 rounded-xl transition-all duration-300"
                  >
                    # {lang === "en" ? item.en : item.ar}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
