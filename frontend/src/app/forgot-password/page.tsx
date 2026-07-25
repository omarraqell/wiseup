"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export default function ForgotPasswordPage() {
  const { lang, dir, t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
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

      {/* Main Card */}
      <div className="relative w-full max-w-md px-6 py-12 z-10">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl flex flex-col gap-6">
          
          {/* Logo & Title */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-1 bg-brand-red rounded-full" />
            <span className="font-[Oswald] text-3xl font-extrabold tracking-wider text-white">
              WISE<span className="text-brand-red">UP</span>
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-white mt-2">
              {t("إعادة تعيين كلمة المرور", "Reset Password")}
            </h2>
            <p className="text-gray-400 text-xs">
              {t("أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور", "Enter your email to receive a password reset link")}
            </p>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center py-6">
              <span className="material-symbols-outlined text-5xl text-brand-red animate-pulse">
                mail_lock
              </span>
              <h3 className="font-bold text-white text-lg">
                {t("تحقق من بريدك الإلكتروني", "Check your Email")}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {t(
                  "أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.",
                  "We have sent a password reset link to your email."
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
                      <span>{t("جارٍ الإرسال...", "Sending...")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("إرسال رابط إعادة التعيين", "Send Reset Link")}</span>
                      <span className="material-symbols-outlined text-sm">send</span>
                    </>
                  )}
                </button>
              </form>

              {/* Footer Text */}
              <div className="text-center text-xs text-gray-400 pt-4 border-t border-white/5 flex justify-center gap-2">
                <Link 
                  href="/login" 
                  className="text-brand-red hover:text-red-400 font-semibold transition-colors"
                >
                  {t("العودة لتسجيل الدخول", "Return to Sign In")}
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
