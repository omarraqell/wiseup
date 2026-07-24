"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-[#1c1b1b] w-full mt-auto border-t border-[#936e69]">
      <div className="w-full py-8 px-6 grid grid-cols-1 md:grid-cols-4 gap-4 max-w-7xl mx-auto">
        {/* Brand */}
        <div className="col-span-1">
          <div className="font-[Oswald] text-2xl font-semibold text-[#fff8f7] mb-2">
            WISEUP
          </div>
          <p className="text-sm text-[#c8c6c5]">
            © 2024 WISEUP. {t("جميع الحقوق محفوظة.", "All rights reserved.")}
          </p>
        </div>

        {/* Footer Links */}
        <div className="col-span-1 md:col-span-3 flex flex-wrap gap-6 md:justify-end items-start">
          {[
            { label: t("الخصوصية", "Privacy"), href: "#" },
            { label: t("الشروط والأحكام", "Terms & Conditions"), href: "#" },
            { label: t("سياسة التوصيل", "Delivery Policy"), href: "#" },
            { label: t("تواصل معنا", "Contact Us"), href: "#" },
          ].map((link, i) => (
            <Link
              key={i}
              href={link.href}
              className="text-sm text-[#c8c6c5] hover:text-brand-red transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
