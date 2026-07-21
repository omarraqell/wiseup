"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export default function LoginPage() {
  const { t } = useLanguage();
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
    <div className="max-w-md mx-auto py-16 px-6">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-6">
        {t("تسجيل الدخول", "Log in")}
      </h1>

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
          placeholder={t("كلمة المرور", "Password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-brand-red text-white rounded py-2 font-[Oswald] disabled:opacity-50"
        >
          {loading ? t("جارٍ الدخول...", "Logging in...") : t("تسجيل الدخول", "Log in")}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#5e3f3b]">
        <Link href="/forgot-password" className="text-brand-red font-medium">
          {t("نسيت كلمة المرور؟", "Forgot password?")}
        </Link>
      </p>
      <p className="mt-2 text-sm text-[#5e3f3b]">
        {t("ليس لديك حساب؟", "Don't have an account?")}{" "}
        <Link href="/signup" className="text-brand-red font-medium">
          {t("إنشاء حساب", "Sign up")}
        </Link>
      </p>
    </div>
  );
}
