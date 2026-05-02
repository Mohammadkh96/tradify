import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { normalizeLang } from "@/lib/i18n";

/**
 * Hydrates the i18n language from the authenticated user's saved preference.
 * Precedence: explicit ?lang= override > saved user.language > localStorage > browser.
 * Only changes language if the user's saved preference differs from current.
 */
export function LanguageHydrator() {
  const { i18n } = useTranslation();
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!user?.language) return;
    // Don't override an explicit ?lang= choice from this session
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("lang")) return;
    } catch {}
    const target = normalizeLang(user.language);
    if (target !== normalizeLang(i18n.language)) {
      i18n.changeLanguage(target);
      try { localStorage.setItem("tradify_lang", target); } catch {}
    }
  }, [user?.language, i18n]);

  return null;
}
