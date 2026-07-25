"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { promoteToAdmin } from "@/lib/api";

export default function AdminLoginPage() {
  const { lang, dir, t } = useLanguage();
  const useRouterObj = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonAdminUser, setNonAdminUser] = useState<any>(null);
  const [promoting, setPromoting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setNonAdminUser(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    const role = user?.user_metadata?.role || user?.user_metadata?.user_metadata?.role;

    if (role === "admin") {
      useRouterObj.push("/admin");
      useRouterObj.refresh();
    } else {
      // User logged in but is not admin
      setNonAdminUser(user);
      setLoading(false);
    }
  }

  async function handlePromote() {
    if (!nonAdminUser) return;
    setPromoting(true);
    setError(null);
    try {
      // We call make-admin endpoint in backend which updates their role to admin in postgres
      await promoteToAdmin();
      
      // Update metadata in Supabase Auth to contain role: admin
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { role: "admin" }
      });

      // Force sign out and sign back in to refresh token, or just redirect
      useRouterObj.push("/admin");
      useRouterObj.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to promote to admin. Make sure the backend server is running.");
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="relative h-screen w-full flex flex-col justify-center items-center overflow-hidden bg-[#f4f5f8] p-4 text-slate-800">

      {/* Back to Store Link */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 transition-all duration-300 text-sm font-semibold shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>{t("العودة للمتجر", "Back to Store")}</span>
        </Link>
      </div>

      <div className="relative w-full max-w-md px-6 py-12 z-10">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl flex flex-col gap-6">
          
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-1 bg-brand-red rounded-full mb-2 animate-pulse" />
            <span className="font-[Oswald] text-3xl font-extrabold tracking-wider">
              WISE<span className="text-brand-red">UP</span> <span className="text-slate-500 text-lg">ADMIN</span>
            </span>
            <h2 className="text-xl font-bold text-slate-800 mt-2">
              {nonAdminUser ? t("حساب غير مشرف", "Access Restricted") : t("تسجيل دخول المشرف", "Admin Portal Sign In")}
            </h2>
            <p className="text-slate-500 text-xs px-2">
              {nonAdminUser 
                ? t("هذا الحساب لا يملك صلاحيات المشرف. يمكنك ترقيته أدناه للتجربة.", "This account does not have Admin privileges. You can elevate it below for development.")
                : t("أدخل البريد الإلكتروني وكلمة المرور للمشرف للوصول إلى لوحة التحكم", "Enter your credentials to access the management interface")}
            </p>
          </div>

          {nonAdminUser ? (
            <div className="flex flex-col gap-4 mt-2">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-xs leading-relaxed flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  <span>{t("بيئة التطوير", "Development Bypass Mode")}</span>
                </div>
                <p>
                  {t(
                    "الحساب الحالي مُسجل كـ (شخصي/شركات). انقر فوق زر الترقي للتجربة وإعطاء الحساب صلاحيات المشرف الكاملة.",
                    "The logged-in account has a normal client role. Click promote below to upgrade this profile to 'admin' in the database."
                  )}
                </p>
                <div className="text-[10px] text-amber-700 mt-1">
                  Email: {nonAdminUser.email}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handlePromote}
                disabled={promoting}
                className="w-full bg-brand-red hover:bg-red-700 active:bg-red-800 text-white rounded-lg py-3 font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-brand-red/20 disabled:opacity-50"
              >
                {promoting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t("جاري الترقية...", "Promoting Account...")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("ترقية الحساب إلى مشرف", "Promote Account to Admin")}</span>
                    <span className="material-symbols-outlined text-sm">security</span>
                  </>
                )}
              </button>

              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setNonAdminUser(null);
                }}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg py-2.5 text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
              >
                {t("تسجيل الخروج", "Sign Out & Try Another Account")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t("البريد الإلكتروني", "Email Address")}
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@wiseup.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-brand-red rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none transition-all text-sm"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t("كلمة المرور", "Password")}
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-brand-red rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none transition-all text-sm"
                  dir="ltr"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-brand-red hover:bg-[#b30c1a] active:bg-[#800812] text-white rounded-lg py-3 font-bold uppercase tracking-wider text-sm transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t("جارٍ التحقق...", "Verifying...")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("تسجيل الدخول كمشرف", "Sign In as Admin")}</span>
                    <span className="material-symbols-outlined text-sm">login</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="text-center text-[10px] text-slate-500 pt-4 border-t border-slate-100 flex flex-col gap-1">
            <span>WiseUp Industrial Management System v1.0.0</span>
            <span>Secure SSL Encrypted Connection</span>
          </div>

        </div>
      </div>
    </div>
  );
}
