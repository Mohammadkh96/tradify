import { useTranslation } from "react-i18next";
import { Check, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LANGUAGES, normalizeLang } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Props {
  variant?: "navbar" | "compact" | "footer";
}

export function LanguageSwitcher({ variant = "navbar" }: Props) {
  const { i18n } = useTranslation();
  const currentCode = normalizeLang(i18n.language);
  const current = SUPPORTED_LANGUAGES.find(l => l.code === currentCode) ?? SUPPORTED_LANGUAGES[0];

  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
    retry: false,
    staleTime: Infinity,
  });

  const handleChange = async (code: string) => {
    await i18n.changeLanguage(code);
    try { localStorage.setItem("tradify_lang", code); } catch {}
    if (user?.id) {
      try {
        await apiRequest("POST", "/api/user/language", { language: code });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      } catch {}
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === "compact" ? "icon" : "sm"}
          className="text-muted-foreground hover:text-foreground gap-2"
          data-testid="button-language-switcher"
          aria-label="Change language"
        >
          <Globe size={16} />
          {variant !== "compact" && (
            <span className="text-xs font-bold uppercase tracking-widest">{current.code}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            data-testid={`item-language-${lang.code}`}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>{lang.flag}</span>
              <span>{lang.native}</span>
            </span>
            {lang.code === current.code && <Check size={14} className="text-emerald-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
