"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/"), 1500);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center">
        <h1 className="font-[Oswald] text-2xl text-brand-red mb-4">
          {t("تم تحديث كلمة المرور", "Password updated")}
        </h1>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16 px-6">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-6">
        {t("كلمة مرور جديدة", "New password")}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="password"
          required
          minLength={6}
          placeholder={t("كلمة المرور الجديدة", "New password")}
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
          {loading ? t("جارٍ التحديث...", "Updating...") : t("تحديث كلمة المرور", "Update password")}
        </button>
      </form>
    </div>
  );
}
