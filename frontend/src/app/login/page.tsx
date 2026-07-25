"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export default function LoginPage() {
  const { lang, dir, t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/");
    router.refresh();
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

      {/* Main Login Card */}
      <div className="relative w-full max-w-md px-6 py-12 z-10">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl flex flex-col gap-8">
          
          {/* Logo & Title */}
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Minimal Brand Accent */}
            <div className="w-12 h-1 bg-brand-red rounded-full" />
            <span className="font-[Oswald] text-3xl font-extrabold tracking-wider text-white">
              WISE<span className="text-brand-red">UP</span>
            </span>
            <p className="text-gray-400 text-xs tracking-wide uppercase">
              {t("المنصة الصناعية الإحترافية", "Professional Industrial Platform")}
            </p>
            <h2 className="text-xl md:text-2xl font-bold text-white mt-4">
              {t("تسجيل الدخول", "Welcome Back")}
            </h2>
            <p className="text-gray-400 text-xs">
              {t("الرجاء إدخال بياناتك للوصول إلى حسابك", "Please enter your details to access your account")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email Input */}
            <div className="flex flex-col gap-2">
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
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-red rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-red/50 transition-all duration-300 text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t("كلمة المرور", "Password")}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand-red hover:text-red-400 transition-colors"
                >
                  {t("نسيت كلمة المرور؟", "Forgot password?")}
                </Link>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-500 material-symbols-outlined text-lg">
                  lock
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-red rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-red/50 transition-all duration-300 text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-xs">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-brand-red hover:bg-[#b30c1a] active:bg-[#800812] text-white rounded-lg py-3.5 font-bold uppercase tracking-wider text-sm transition-all duration-300 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(153,10,22,0.4)] flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t("جارٍ تسجيل الدخول...", "Logging in...")}</span>
                </>
              ) : (
                <>
                  <span>{t("تسجيل الدخول", "Sign In")}</span>
                  <span className="material-symbols-outlined text-sm">login</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Text */}
          <div className="text-center text-xs text-gray-400 pt-4 border-t border-white/5">
            {t("ليس لديك حساب؟", "New to WiseUp?")}{" "}
            <Link 
              href="/signup" 
              className="text-brand-red hover:text-red-400 font-semibold transition-colors"
            >
              {t("إنشاء حساب جديد", "Create an account")}
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
