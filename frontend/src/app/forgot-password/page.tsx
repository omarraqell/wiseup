"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
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

  if (sent) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <h1 className="font-[Oswald] text-2xl text-brand-red mb-4">
          {t("تحقق من بريدك الإلكتروني", "Check your email")}
        </h1>
        <p className="text-[#5e3f3b]">
          {t(
            "أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.",
            "We sent a password reset link to your email."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16 px-6">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-6">
        {t("إعادة تعيين كلمة المرور", "Reset your password")}
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

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-brand-red text-white rounded py-2 font-[Oswald] disabled:opacity-50"
        >
          {loading ? t("جارٍ الإرسال...", "Sending...") : t("إرسال رابط إعادة التعيين", "Send reset link")}
        </button>
      </form>
    </div>
  );
}
