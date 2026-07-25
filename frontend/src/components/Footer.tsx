"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function Footer() {
  const { lang, dir, t } = useLanguage();

  return (
    <footer className="bg-[#0b0808] text-white border-t border-neutral-800/80 w-full mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Brand Column */}
        <div className="flex flex-col gap-4">
          <div className="font-[Oswald] text-3xl font-extrabold tracking-wider text-white">
            WISE<span className="text-brand-red">UP</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
            {t(
              "نحن نوفر أدوات ومعدات صناعية متميزة مصممة للمهنيين والمحترفين الذين يطلبون أقصى درجات التحمل والدقة والأداء.",
              "We provide premium-grade industrial hand tools and heavy-duty engineering equipment built for professionals who demand extreme durability, precision, and performance."
            )}
          </p>
          {/* Social Icons */}
          <div className="flex items-center gap-3 mt-2">
            {["facebook", "instagram", "youtube", "linkedin"].map((social) => (
              <a
                key={social}
                href="#"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-brand-red hover:border-brand-red transition-all duration-300"
              >
                <i className={`fab fa-${social} text-sm`}></i>
              </a>
            ))}
          </div>
        </div>

        {/* Categories Links */}
        <div className="flex flex-col gap-4">
          <h3 className="font-[Oswald] text-base font-bold uppercase tracking-wider text-white border-b border-brand-red/30 pb-2 w-fit">
            {t("فئات المنتجات", "Categories")}
          </h3>
          <ul className="flex flex-col gap-2.5 text-sm text-gray-400">
            <li>
              <Link href="/catalog?category=pliers-series" className="hover:text-brand-red transition-colors duration-200">
                {t("سلسلة الزراديات", "Pliers Series")}
              </Link>
            </li>
            <li>
              <Link href="/catalog?category=wrench-series" className="hover:text-brand-red transition-colors duration-200">
                {t("سلسلة المفاتيح", "Wrench Series")}
              </Link>
            </li>
            <li>
              <Link href="/catalog?category=measurement-series" className="hover:text-brand-red transition-colors duration-200">
                {t("سلسلة أدوات القياس", "Measurement Series")}
              </Link>
            </li>
            <li>
              <Link href="/catalog?category=hammer-series" className="hover:text-brand-red transition-colors duration-200">
                {t("سلسلة المطارق", "Hammer Series")}
              </Link>
            </li>
          </ul>
        </div>

        {/* Corporate & Support Links */}
        <div className="flex flex-col gap-4">
          <h3 className="font-[Oswald] text-base font-bold uppercase tracking-wider text-white border-b border-brand-red/30 pb-2 w-fit">
            {t("الدعم والخدمات", "Support & Care")}
          </h3>
          <ul className="flex flex-col gap-2.5 text-sm text-gray-400">
            <li>
              <Link href="#" className="hover:text-brand-red transition-colors duration-200">
                {t("سياسة الكفالة والضمان", "Warranty & Lifetime Guarantee")}
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-brand-red transition-colors duration-200">
                {t("شروط وأحكام البيع", "Terms & Conditions")}
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-brand-red transition-colors duration-200">
                {t("سياسة التوصيل والشحن", "Delivery & Shipping")}
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-brand-red transition-colors duration-200">
                {t("طلب حساب شركات وموزعين", "Corporate & Dealer Account Request")}
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact Info Column */}
        <div className="flex flex-col gap-4">
          <h3 className="font-[Oswald] text-base font-bold uppercase tracking-wider text-white border-b border-brand-red/30 pb-2 w-fit">
            {t("تواصل معنا", "Get In Touch")}
          </h3>
          <ul className="flex flex-col gap-3 text-sm text-gray-400">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-brand-red text-lg mt-0.5">location_on</span>
              <span>{t("عمان، الأردن - المنطقة الصناعية", "Amman, Jordan - Industrial Area")}</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="material-symbols-outlined text-brand-red text-lg">phone</span>
              <span dir="ltr">+962 6 123 4567</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="material-symbols-outlined text-brand-red text-lg">mail</span>
              <span>info@wiseup-tools.com</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-neutral-900 bg-neutral-950 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <div>
            © 2026 WISEUP. {t("جميع الحقوق محفوظة. صُمم للمهنيين.", "All rights reserved. Built for professionals.")}
          </div>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-white transition-colors">{t("سياسة الخصوصية", "Privacy Policy")}</Link>
            <Link href="#" className="hover:text-white transition-colors">{t("اتفاقية المستخدم", "User Agreement")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
