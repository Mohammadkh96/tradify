import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { NoIndexSEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

export default function ResetPassword() {
  const { t } = useTranslation("common", { keyPrefix: "publicPages" });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const isValid = newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError(t("resetMinLengthError"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("resetMismatchError"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password-with-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || t("resetFailedDefault"));
        return;
      }

      setIsSuccess(true);
      toast({
        title: t("resetToastTitle"),
        description: t("resetToastDesc"),
      });

      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(t("resetGenericError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-foreground uppercase tracking-tight mb-3" data-testid="text-invalid-link">
            {t("resetInvalidTitle")}
          </h1>
          <p className="text-muted-foreground mb-8" data-testid="text-invalid-description">
            {t("resetInvalidDesc")}
          </p>
          <Link to="/login">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider" data-testid="button-back-to-login">
              <ArrowLeft size={16} className="mr-2" />
              {t("resetBackToLogin")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-emerald-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-foreground uppercase tracking-tight mb-3" data-testid="text-success-heading">
            {t("resetSuccessTitle1")} <span className="text-emerald-500">{t("resetSuccessTitle2")}</span>
          </h1>
          <p className="text-muted-foreground mb-8" data-testid="text-success-description">
            {t("resetSuccessDesc")}
          </p>
          <Link to="/login">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider" data-testid="button-go-to-login">
              {t("resetGoToLogin")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <NoIndexSEO title={t("resetSeoTitle")} />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="text-emerald-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2" data-testid="text-reset-heading">
            {t("resetHeading1")} <span className="text-emerald-500">{t("resetHeading2")}</span>
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-reset-description">
            {t("resetSubheading")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("resetNewPasswordLabel")}
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("resetNewPlaceholder")}
                className="bg-muted/50 border-border pr-10"
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("resetConfirmLabel")}
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("resetConfirmPlaceholder")}
                className="bg-muted/50 border-border pr-10"
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-confirm"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-amber-500" data-testid="text-password-hint">{t("resetMinLengthError")}</p>
          )}

          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500" data-testid="text-mismatch">{t("resetMismatchError")}</p>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" data-testid="text-error">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider h-11"
            data-testid="button-reset-password"
          >
            {isSubmitting ? t("resetButtonResetting") : t("resetButtonReset")}
          </Button>

          <div className="text-center">
            <Link to="/login" className="text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-back-to-login">
              <ArrowLeft size={12} className="inline mr-1" />
              {t("resetBackToLogin")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
