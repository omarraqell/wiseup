/* Shared storefront helpers. Loaded by every page before its own script. */
(function () {
  const LANGS = { ar: { dir: "rtl", money: (v) => `${v} دينار` },
                  en: { dir: "ltr", money: (v) => `${v} JOD` } };

  function lang() {
    return localStorage.getItem("wiseup_lang") || "ar";
  }

  function setLang(l) {
    localStorage.setItem("wiseup_lang", l);
    location.reload();
  }

  function applyDir() {
    const l = lang();
    document.documentElement.lang = l;
    document.documentElement.dir = LANGS[l].dir;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function t(p) {
    return lang() === "en" ? (p.name_en || p.name_ar) : (p.name_ar || p.name_en);
  }

  function money(p) {
    // No price_jod key = a business account (Phase 3) or bad data. Render nothing.
    if (p == null || p.price_jod === undefined || p.price_jod === null) return "";
    return LANGS[lang()].money(p.price_jod);
  }

  function productCard(p) {
    const price = money(p);
    return `
      <a href="/product?code=${encodeURIComponent(p.code)}"
         class="block rounded border hover:shadow-lg transition p-3 bg-white">
        <img src="${esc(p.image_url)}" alt="${esc(t(p))}" loading="lazy"
             class="w-full h-40 object-contain mb-2"
             onerror="this.style.visibility='hidden'">
        <div class="text-sm font-semibold line-clamp-2">${esc(t(p))}</div>
        <div class="text-xs text-gray-500 mt-1">${esc(p.code)} · ${esc(p.unit)}</div>
        ${price ? `<div class="text-brand font-bold mt-1">${esc(price)}</div>` : ""}
      </a>`;
  }

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  }

  window.WISEUP = { lang, setLang, applyDir, esc, t, money, productCard, getJSON };
})();
