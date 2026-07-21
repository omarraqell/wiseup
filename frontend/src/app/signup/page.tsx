"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

type Role = "personal" | "business";

export default function SignupPage() {
  const { t } = useLanguage();
  const [role, setRole] = useState<Role>("personal");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          name,
          phone,
          ...(role === "business"
            ? { company_name: companyName, company_city: companyCity, company_type: companyType }
            : {}),
        },
      },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <h1 className="font-[Oswald] text-2xl text-brand-red mb-4">
          {t("تحقق من بريدك الإلكتروني", "Check your email")}
        </h1>
        <p className="text-[#5e3f3b]">
          {t(
            "أرسلنا رابط تأكيد إلى بريدك الإلكتروني. الرجاء النقر عليه لتفعيل حسابك.",
            "We sent a confirmation link to your email. Click it to activate your account."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16 px-6">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-6">
        {t("إنشاء حساب", "Create an account")}
      </h1>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setRole("personal")}
          className={`flex-1 py-2 rounded font-[Oswald] ${role === "personal" ? "bg-brand-red text-white" : "bg-[#F5F5F5] text-[#5e3f3b]"}`}
        >
          {t("شخصي", "Personal")}
        </button>
        <button
          type="button"
          onClick={() => setRole("business")}
          className={`flex-1 py-2 rounded font-[Oswald] ${role === "business" ? "bg-brand-red text-white" : "bg-[#F5F5F5] text-[#5e3f3b]"}`}
        >
          {t("شركة", "Business")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder={t("البريد الإلكتروني", "Email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder={t("كلمة المرور", "Password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          required
          placeholder={t("الاسم", "Name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="tel"
          placeholder={t("الهاتف", "Phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border rounded px-3 py-2"
        />

        {role === "business" && (
          <>
            <input
              type="text"
              required
              placeholder={t("اسم الشركة", "Company name")}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <input
              type="text"
              required
              placeholder={t("المدينة", "City")}
              value={companyCity}
              onChange={(e) => setCompanyCity(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <input
              type="text"
              required
              placeholder={t("نوع النشاط", "Business type")}
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-brand-red text-white rounded py-2 font-[Oswald] disabled:opacity-50"
        >
          {loading ? t("جارٍ الإنشاء...", "Creating...") : t("إنشاء حساب", "Create account")}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#5e3f3b]">
        {t("لديك حساب بالفعل؟", "Already have an account?")}{" "}
        <Link href="/login" className="text-brand-red font-medium">
          {t("تسجيل الدخول", "Log in")}
        </Link>
      </p>
    </div>
  );
}
