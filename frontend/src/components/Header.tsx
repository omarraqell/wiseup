"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  const { user, role, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome) {
      setIsScrolled(false);
      return;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  const navLinks = [
    { href: "/catalog", label: t("المتجر", "Shop") },
    { href: "/catalog", label: t("الأدوات اليدوية", "Hand Tools") },
    { href: "/catalog", label: t("المجموعات", "Collections") },
    { href: "/catalog", label: t("العروض", "Offers") },
    { href: "#", label: t("من نحن", "About Us") },
  ];

  // Conditional header classes
  const headerClass = isHome
    ? `fixed top-0 left-0 right-0 w-full z-50 transition-all duration-500 ${
        isScrolled || mobileOpen
          ? "bg-white/90 backdrop-blur-md border-b border-neutral-200/60 shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`
    : "bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-neutral-200/60 w-full";

  // Conditional button classes
  const buttonClass = isHome && !isScrolled && !mobileOpen
    ? "p-2.5 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300 flex items-center justify-center"
    : "p-2.5 text-neutral-700 hover:text-brand-red hover:bg-neutral-100 rounded-full transition-all duration-300 flex items-center justify-center";

  return (
    <header className={headerClass}>
      <div className="flex justify-between items-center w-full px-6 max-w-7xl mx-auto h-20">
        {/* Brand Logo */}
        <Link
          href="/"
          className={`font-[Oswald] text-2xl md:text-[32px] font-bold tracking-tight transition-colors duration-500 ${
            isHome && !isScrolled && !mobileOpen ? "text-white" : "text-brand-red"
          }`}
        >
          WISEUP
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-2 items-center h-full">
          {navLinks.map((link, i) => {
            const isActive = pathname === link.href || (link.href === "/catalog" && pathname.startsWith("/product"));
            const isTransparent = isHome && !isScrolled && !mobileOpen;
            return (
              <Link
                key={i}
                href={link.href}
                className={`group relative h-full flex items-center px-4 font-semibold text-sm tracking-wide uppercase transition-colors duration-300 ${
                  isTransparent
                    ? isActive
                      ? "text-brand-red"
                      : "text-white/80 hover:text-white"
                    : isActive
                      ? "text-brand-red"
                      : "text-neutral-700 hover:text-brand-red"
                }`}
              >
                <span>{link.label}</span>
                {/* Sliding Underline Indicator */}
                <span
                  className={`absolute bottom-0 left-4 right-4 h-[2.5px] bg-brand-red transition-transform duration-300 origin-left scale-x-0 group-hover:scale-x-100 ${
                    isActive ? "!scale-x-100" : ""
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* Trailing Actions */}
        <div className="flex gap-2 items-center">
          {!loading && (
            user ? (
              <div className="flex items-center gap-1">
                <span className={`hidden sm:inline text-xs font-semibold px-3 py-1 rounded-full ${
                  isHome && !isScrolled && !mobileOpen 
                    ? "bg-white/10 text-white" 
                    : "bg-neutral-100 text-neutral-700"
                }`}>
                  {role === "business" ? t("حساب تجاري", "Business") : t("حسابي", "My Account")}
                </span>
                <button
                  onClick={signOut}
                  className={buttonClass}
                  title={t("تسجيل الخروج", "Log out")}
                >
                  <span className="material-symbols-outlined text-xl">logout</span>
                </button>
              </div>
            ) : (
              <Link 
                href="/login" 
                className={`text-xs font-bold px-4 py-2 rounded-full transition-all duration-300 ${
                  isHome && !isScrolled && !mobileOpen 
                    ? "text-white border border-white/20 hover:bg-white hover:text-black" 
                    : "text-neutral-700 border border-neutral-300 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                }`}
              >
                {t("تسجيل الدخول", "Log in")}
              </Link>
            )
          )}
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className={buttonClass}
            title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
          >
            <span className="material-symbols-outlined text-xl">language</span>
          </button>
          <button className={buttonClass}>
            <span className="material-symbols-outlined text-xl">shopping_cart</span>
          </button>
          {/* Mobile hamburger */}
          <button
            className={`md:hidden ${buttonClass}`}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span className="material-symbols-outlined text-xl">
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-neutral-200/60 bg-white px-6 py-4 flex flex-col gap-3 shadow-lg">
          {navLinks.map((link, i) => {
            const isActive = pathname === link.href || (link.href === "/catalog" && pathname.startsWith("/product"));
            return (
              <Link
                key={i}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`font-semibold text-base py-2.5 border-b border-neutral-100 last:border-0 transition-colors ${
                  isActive ? "text-brand-red" : "text-neutral-700 hover:text-brand-red"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}

