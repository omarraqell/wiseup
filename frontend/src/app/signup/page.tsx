"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

type Role = "personal" | "business";

export default function SignupPage() {
  const { lang, dir, t } = useLanguage();
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

  return (
    <div className="relative h-screen w-full flex flex-col justify-center items-center overflow-hidden bg-[#0a0505] p-4">
      {/* Industrial Aesthetic Background Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30" 
        style={{ backgroundImage: "url('/hero-bg.png')" }} 
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#1a080a] via-[#0d0607]/90 to-[#070304]" />
      
      {/* Dynamic Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(153,10,22,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(153,10,22,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Back to Home Button on Top */}
      <div className={`absolute top-6 ${dir === "rtl" ? "right-6" : "left-6"} z-20`}>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm text-sm font-semibold"
        >
          <span className={`material-symbols-outlined text-lg ${dir === "rtl" ? "" : "rotate-180"}`}>
            arrow_forward
          </span>
          <span>{t("العودة للرئيسية", "Back to Home")}</span>
        </Link>
      </div>

      {/* Main Signup Card */}
      <div className="relative w-full max-w-2xl z-10 flex flex-col items-center justify-center">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 max-h-[80vh] w-full overflow-hidden">
          
          {/* Logo & Title */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-1 bg-brand-red rounded-full" />
            <span className="font-[Oswald] text-3xl font-extrabold tracking-wider text-white">
              WISE<span className="text-brand-red">UP</span>
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-white mt-2">
              {t("إنشاء حساب جديد", "Create an Account")}
            </h2>
            <p className="text-gray-400 text-xs">
              {t("انضم إلينا اليوم للوصول إلى مجموعة واسعة من المنتجات والميزات الإضافية", "Join us today for wider product catalogs and features")}
            </p>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-4 text-center py-6">
              <span className="material-symbols-outlined text-5xl text-brand-red animate-pulse">
                mark_email_read
              </span>
              <h3 className="font-bold text-white text-lg">
                {t("تحقق من بريدك الإلكتروني", "Verify your Email")}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {t(
                  "أرسلنا رابط تأكيد إلى بريدك الإلكتروني. الرجاء النقر عليه لتفعيل حسابك.",
                  "We sent an activation link to your email. Please click it to complete registration."
                )}
              </p>
              <Link 
                href="/login" 
                className="mt-4 bg-brand-red hover:bg-[#b30c1a] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-300"
              >
                {t("الانتقال لتسجيل الدخول", "Go to Login")}
              </Link>
            </div>
          ) : (
            <>
              {/* Role Switcher */}
              <div className="flex gap-2 p-1 bg-white/5 rounded-lg border border-white/5">
                <button
                  type="button"
                  onClick={() => setRole("personal")}
                  className={`flex-1 py-2.5 rounded-md font-semibold transition-all duration-300 text-sm ${
                    role === "personal"
                      ? "bg-brand-red text-white shadow-lg"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {t("حساب شخصي", "Personal Account")}
                </button>
                <button
                  type="button"
                  onClick={() => setRole("business")}
                  className={`flex-1 py-2.5 rounded-md font-semibold transition-all duration-300 text-sm ${
                    role === "business"
                      ? "bg-brand-red text-white shadow-lg"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {t("حساب شركات", "Business Account")}
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto px-2 py-1 grid grid-cols-1 md:grid-cols-2 gap-4 no-scrollbar">
                {/* Name Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {t("الاسم الكامل", "Full Name")}
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-gray-500 material-symbols-outlined text-lg">
                      person
                    </span>
                    <input
                      type="text"
                      required
                      placeholder={t("جون دو", "John Doe")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-red rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-red/50 transition-all duration-300 text-sm"
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {t("البريد الإلكتروني", "Email Address")}
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-gray-500 material-symbols-outlined text-lg">
                      mail
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-red rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-red/50 transition-all duration-300 text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Phone Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {t("الهاتف", "Phone Number")}
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-gray-500 material-symbols-outlined text-lg">
                      call
                    </span>
                    <input
                      type="tel"
                      required
                      placeholder="+962 7 XXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-red rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-red/50 transition-all duration-300 text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {t("كلمة المرور", "Password")}
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-gray-500 material-symbols-outlined text-lg">
                      lock
                    </span>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-red rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-red/50 transition-all duration-300 text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Business Specific Fields */}
                {role === "business" && (
                  <div className="flex flex-col gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 mt-2 md:col-span-2">
                    <span className="text-xs font-bold text-brand-red uppercase tracking-wider">
                      {t("معلومات الشركة", "Company details")}
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Company Name */}
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <input
                          type="text"
                          required
                          placeholder={t("اسم الشركة", "Company name")}
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-red rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-red/50 transition-all duration-300 text-sm"
                        />
                      </div>

                      {/* City */}
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="text"
                          required
                          placeholder={t("المدينة", "City")}
                          value={companyCity}
                          onChange={(e) => setCompanyCity(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-red rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-red/50 transition-all duration-300 text-sm"
                        />
                      </div>

                      {/* Business Type */}
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="text"
                          required
                          placeholder={t("نوع النشاط", "Business type")}
                          value={companyType}
                          onChange={(e) => setCompanyType(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-red rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-red/50 transition-all duration-300 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-xs md:col-span-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-brand-red hover:bg-[#b30c1a] active:bg-[#800812] text-white rounded-lg py-3 font-bold uppercase tracking-wider text-sm transition-all duration-300 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(153,10,22,0.4)] flex items-center justify-center gap-2 cursor-pointer md:col-span-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{t("جارٍ إنشاء الحساب...", "Creating Account...")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("إنشاء حساب", "Register")}</span>
                      <span className="material-symbols-outlined text-sm">person_add</span>
                    </>
                  )}
                </button>
              </form>

              {/* Footer Text */}
              <div className="text-center text-xs text-gray-400 pt-4 border-t border-white/5">
                {t("لديك حساب بالفعل؟", "Already have an account?")}{" "}
                <Link 
                  href="/login" 
                  className="text-brand-red hover:text-red-400 font-semibold transition-colors"
                >
                  {t("تسجيل الدخول", "Sign In")}
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
