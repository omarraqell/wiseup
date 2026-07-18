"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

export default function Header() {
  const { lang, setLang, t } = useLanguage();
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
    ? `fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${
        isScrolled || mobileOpen
          ? "bg-[#fff8f7]/95 backdrop-blur-md border-b border-[#E5E5E5] shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`
    : "bg-[#fff8f7] sticky top-0 z-50 border-b border-[#E5E5E5] w-full";

  // Conditional link classes
  const getLinkClass = (i: number) => {
    const isActive = i === 0;
    const isTransparent = isHome && !isScrolled && !mobileOpen;

    if (isActive) {
      return "text-brand-red font-bold border-b-2 border-brand-red";
    }

    return isTransparent
      ? "text-white/80 hover:text-white hover:bg-white/5"
      : "text-[#5e3f3b] hover:text-brand-red";
  };

  // Conditional button classes
  const buttonClass = isHome && !isScrolled && !mobileOpen
    ? "p-2 text-white hover:bg-white/10 rounded transition-colors"
    : "p-2 text-brand-red hover:bg-[#F5F5F5] rounded transition-colors";

  return (
    <header className={headerClass}>
      <div className="flex justify-between items-center w-full px-6 max-w-7xl mx-auto h-20">
        {/* Brand Logo */}
        <Link
          href="/"
          className="font-[Oswald] text-2xl md:text-[32px] font-semibold text-brand-red tracking-tight"
        >
          WISEUP
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-4 items-center h-full">
          {navLinks.map((link, i) => (
            <Link
              key={i}
              href={link.href}
              className={`h-full flex items-center px-3 font-[Oswald] text-lg transition-colors ${getLinkClass(
                i
              )}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Trailing Actions */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className={buttonClass}
            title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
          >
            <span className="material-symbols-outlined">language</span>
          </button>
          <button className={buttonClass}>
            <span className="material-symbols-outlined">shopping_cart</span>
          </button>
          {/* Mobile hamburger */}
          <button
            className={`md:hidden ${buttonClass}`}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span className="material-symbols-outlined">
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-[#E5E5E5] bg-[#fff8f7] px-6 py-4 flex flex-col gap-3">
          {navLinks.map((link, i) => (
            <Link
              key={i}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="font-[Oswald] text-lg text-[#5e3f3b] hover:text-brand-red transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

